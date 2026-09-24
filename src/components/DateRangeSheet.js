import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react-native';
import { theme } from '../theme';
import { useTranslation } from '../constants/translations';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The cells of one month: leading blanks so the 1st lands on its weekday. */
const monthGrid = (year, month) => {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = new Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= days; d += 1) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
};

const pretty = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

/**
 * Pick a date range on one calendar.
 *
 * This replaced two separate native date dialogs with a bar in between: the
 * shop chose a start in one dialog, the dialog closed, then a second dialog
 * asked for the end. Neither showed the range being built, and a start with no
 * end left the screen in a half-picked state.
 *
 * Here the whole range is one gesture — tap the start, tap the end — and the
 * days between fill in as you go. A single tap is a single day, which is what
 * "show me the 14th" should cost.
 */
export const DateRangeSheet = ({ visible, today, initialFrom, initialTo, onClose, onApply }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ start: null, end: null });
  const [cursor, setCursor] = useState(() => {
    const [y, m] = (initialFrom || today).split('-').map(Number);
    return { year: y, month: m - 1 };
  });

  // Reopening should offer the range currently in force, not the last draft.
  useEffect(() => {
    if (!visible) return;
    setDraft({ start: initialFrom ?? null, end: initialTo ?? null });
    const [y, m] = (initialFrom || today).split('-').map(Number);
    setCursor({ year: y, month: m - 1 });
  }, [visible, initialFrom, initialTo, today]);

  const atCurrentMonth = useMemo(
    () => `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}` >= today.slice(0, 7),
    [cursor, today],
  );

  const shiftMonth = (n) =>
    setCursor(({ year, month }) => {
      const d = new Date(Date.UTC(year, month + n, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

  // First tap opens a range, second closes it. Tapping before the start just
  // restarts — nobody means "an empty range" by tapping backwards.
  const tapDay = (iso) =>
    setDraft((d) => {
      if (!d.start || d.end) return { start: iso, end: null };
      return iso < d.start ? { start: iso, end: d.start } : { start: d.start, end: iso };
    });

  const apply = () => {
    if (!draft.start) return;
    onApply({ from: draft.start, to: draft.end ?? draft.start });
  };

  const cells = monthGrid(cursor.year, cursor.month);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('historyPickDates')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#1E293B" size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthRow}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.navBtn}>
              <ChevronLeft color="#475569" size={20} />
            </TouchableOpacity>
            <Text style={styles.monthText}>{MONTHS[cursor.month]} {cursor.year}</Text>
            <TouchableOpacity
              onPress={() => shiftMonth(1)}
              style={styles.navBtn}
              disabled={atCurrentMonth}
            >
              <ChevronRight color={atCurrentMonth ? '#CBD5E1' : '#475569'} size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEK_LETTERS.map((letter, i) => (
              <Text key={`${letter}-${i}`} style={styles.weekText}>{letter}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((iso, i) => {
              if (!iso) return <View key={`blank-${i}`} style={styles.cell} />;
              const future = iso > today;
              const isStart = iso === draft.start;
              const isEnd = iso === draft.end;
              const inRange = draft.end && iso > draft.start && iso < draft.end;
              return (
                <TouchableOpacity
                  key={iso}
                  style={[styles.cell, inRange && styles.cellInRange]}
                  disabled={future}
                  onPress={() => tapDay(iso)}
                >
                  <View style={[styles.day, (isStart || isEnd) && styles.dayOn]}>
                    <Text
                      style={[
                        styles.dayText,
                        future && styles.dayTextOff,
                        (isStart || isEnd) && styles.dayTextOn,
                      ]}
                    >
                      {Number(iso.slice(8))}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.summary}>
            {draft.start
              ? draft.end
                ? `${pretty(draft.start)} – ${pretty(draft.end)}`
                : t('historyPickEnd')
              : t('historyPickStart')}
          </Text>

          <View style={styles.actions}>
            {/* Clear has to REMOVE the filter, not just blank the two dates in
                this sheet. It only reset the draft before, and Apply is
                disabled with no start date — so once a range was applied there
                was no way back to the default list at all. */}
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => {
                setDraft({ start: null, end: null });
                onApply({ from: null, to: null });
              }}
            >
              <RotateCcw color="#64748B" size={15} style={styles.resetIcon} />
              <Text style={styles.resetText}>{t('historyClear')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, !draft.start && styles.applyBtnOff]}
              disabled={!draft.start}
              onPress={apply}
            >
              <Text style={styles.applyText}>{t('historyApply')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF',
    borderRadius: 20, padding: 16,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  title: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  navBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekText: {
    width: `${100 / 7}%`, textAlign: 'center',
    fontSize: 11, fontWeight: '800', color: '#94A3B8',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' },
  cellInRange: { backgroundColor: '#ECFDF5' },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: theme.colors.primary },
  dayText: { fontSize: 13.5, fontWeight: '700', color: '#334155' },
  dayTextOff: { color: '#CBD5E1' },
  dayTextOn: { color: '#FFFFFF' },
  summary: {
    fontSize: 12.5, fontWeight: '700', color: '#64748B',
    textAlign: 'center', marginTop: 12,
  },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  resetIcon: { marginRight: 5 },
  resetText: { fontSize: 13.5, fontWeight: '700', color: '#64748B' },
  applyBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 13,
    borderRadius: 12, backgroundColor: theme.colors.primary,
  },
  applyBtnOff: { backgroundColor: '#CBD5E1' },
  applyText: { fontSize: 14.5, fontWeight: '800', color: '#FFFFFF' },
});

export default DateRangeSheet;
