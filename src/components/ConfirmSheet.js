import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { AlertTriangle, HelpCircle } from 'lucide-react-native';
import { theme } from '../theme';
import { useTranslation } from '../constants/translations';

/**
 * A yes/no the app asks in its own voice.
 *
 * `Alert.alert` draws an OS dialog: square on one Android version, rounded on
 * the next, system font throughout, and ALL-CAPS buttons that read as shouting
 * next to the rest of the app. For a question about money — cancelling an order
 * that may already be paid for — that mismatch is worst exactly where the shop
 * most needs to trust what it is reading.
 */
export const ConfirmSheet = ({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  // Defaulted here, not in the signature, so it follows the language.
  const cancelText = cancelLabel ?? t('keepBtn');
  const Icon = destructive ? AlertTriangle : HelpCircle;
  const tint = destructive ? '#DC2626' : theme.colors.primary;
  const wash = destructive ? '#FEF2F2' : '#ECFDF5';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={busy ? undefined : onCancel}
        />
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: wash }]}>
            <Icon color={tint} size={26} />
          </View>

          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={busy}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: tint }, busy && styles.confirmBusy]}
              onPress={onConfirm}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28,
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF',
    borderRadius: 20, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18,
    alignItems: 'center',
  },
  iconWrap: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  body: {
    fontSize: 13.5, fontWeight: '500', color: '#64748B',
    textAlign: 'center', marginTop: 8, lineHeight: 20,
  },
  actions: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 20 },
  cancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 13,
    borderRadius: 13, backgroundColor: '#F1F5F9', marginRight: 10,
  },
  cancelText: { fontSize: 14.5, fontWeight: '800', color: '#475569' },
  confirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 13 },
  confirmBusy: { opacity: 0.7 },
  confirmText: { fontSize: 14.5, fontWeight: '800', color: '#FFFFFF' },
});

export default ConfirmSheet;
