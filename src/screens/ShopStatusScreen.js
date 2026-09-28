import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Clock, XCircle, Ban, Phone, Mail, RefreshCw, LogOut } from 'lucide-react-native';
import { AuthContext, SHOP_ROUTE } from '../context/AuthContext';
import { api } from '../api';
import { theme } from '../theme';
import { useScreenPadding } from '../hooks/useScreenPadding';
import { useTranslation } from '../constants/translations';

// The three post-submit verification states (§2.3). Which one renders is
// decided by GET /owner/shop, re-read on every app open and on pull-to-refresh.
export const ShopStatusScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { shop, shopRoute, refreshShop, logout } = useContext(AuthContext);

  const [support, setSupport] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api.platform.getSupportContact().then(setSupport).catch(() => {});
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshShop();
    } catch (e) {
      // Leave the current state on screen if the refresh fails.
    } finally {
      setRefreshing(false);
    }
  }, [refreshShop]);

  const config = {
    [SHOP_ROUTE.PENDING]: {
      Icon: Clock,
      tint: '#F59E0B',
      bg: '#FFFBEB',
      badgeText: 'Status: Pending Admin Approval',
      badgeBg: '#FEF3C7',
      badgeColor: '#D97706',
      title: t('verificationInProgress'),
      body: t('verificationInProgressBody'),
      cta: { label: t('viewUpdateDocuments'), onPress: () => navigation.navigate('DocumentUpload') },
    },
    [SHOP_ROUTE.REJECTED]: {
      Icon: XCircle,
      tint: '#DC2626',
      bg: '#FEF2F2',
      badgeText: 'Status: Rejected',
      badgeBg: '#FEE2E2',
      badgeColor: '#DC2626',
      title: t('shopNotApproved'),
      body: shop?.rejection_reason || 'Some details or documents need to be corrected before we can approve your shop.',
      cta: { label: t('reuploadResubmit'), onPress: () => navigation.navigate('DocumentUpload') },
    },
    [SHOP_ROUTE.SUSPENDED]: {
      Icon: Ban,
      tint: '#7C2D12',
      bg: '#FEF2F2',
      badgeText: 'Status: Suspended',
      badgeBg: '#FFEDD5',
      badgeColor: '#C2410C',
      title: t('shopSuspended'),
      body:
        shop?.suspension_reason
        || 'Your shop is currently suspended and hidden from customers. Please contact support.',
      cta: null,
    },
  }[shopRoute] || {
    Icon: Clock,
    tint: '#F59E0B',
    bg: '#FFFBEB',
    badgeText: 'Status: Pending Verification',
    badgeBg: '#FEF3C7',
    badgeColor: '#D97706',
    title: t('checkingShopStatus'),
    body: t('pullDownToRefresh'),
    cta: null,
  };

  const { Icon, tint, bg, badgeText, badgeBg, badgeColor, title, body, cta } = config;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={[styles.statusBadgeChip, { backgroundColor: badgeBg }]}>
          <Text style={[styles.statusBadgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>

        <View style={[styles.iconWrap, { backgroundColor: bg }]}>
          <Icon color={tint} size={44} />
        </View>

        <Text style={styles.title}>{title}</Text>
        {shop?.name ? <Text style={styles.shopName}>{shop.name}</Text> : null}
        <Text style={styles.body}>{body}</Text>

        {cta ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={cta.onPress} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{cta.label}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.secondaryBtn} onPress={onRefresh} activeOpacity={0.85}>
          {refreshing ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <RefreshCw color={theme.colors.primary} size={17} />
              <Text style={styles.secondaryBtnText}>{t('checkAgain')}</Text>
            </>
          )}
        </TouchableOpacity>

        {support ? (
          <View style={styles.supportCard}>
            <Text style={styles.supportTitle}>{t('needHelp')}</Text>
            {support.phone ? (
              <TouchableOpacity
                style={styles.supportRow}
                onPress={() => Linking.openURL(`tel:${support.phone}`)}
              >
                <Phone color="#475569" size={17} />
                <Text style={styles.supportText}>{support.phone}</Text>
              </TouchableOpacity>
            ) : null}
            {support.email ? (
              <TouchableOpacity
                style={styles.supportRow}
                onPress={() => Linking.openURL(`mailto:${support.email}`)}
              >
                <Mail color="#475569" size={17} />
                <Text style={styles.supportText}>{support.email}</Text>
              </TouchableOpacity>
            ) : null}
            {support.live_chat_hours ? (
              <Text style={styles.supportHours}>Support hours: {support.live_chat_hours}</Text>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <LogOut color="#94A3B8" size={16} />
          <Text style={styles.logoutText}>{t('logOutShort')}</Text>
        </TouchableOpacity>

        {/* Deletion has to be reachable whatever state the shop is in — an
            owner stuck in review or suspended must not need support for it. */}
        <TouchableOpacity
          style={styles.deleteLink}
          onPress={() => navigation.navigate('DeleteAccount')}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteLinkText}>{t('deleteAccount', 'Delete Account')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 24, alignItems: 'center', paddingTop: 32, paddingBottom: 40 },
  statusBadgeChip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  iconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  shopName: { fontSize: 15, fontWeight: '700', color: theme.colors.primary, marginTop: 6 },
  body: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 28,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    width: '100%',
  },
  secondaryBtnText: { color: theme.colors.primary, fontSize: 15, fontWeight: '700' },
  supportCard: {
    marginTop: 32,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  supportTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  supportRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  supportText: { fontSize: 14, color: '#334155', fontWeight: '600' },
  supportHours: { fontSize: 12, color: '#94A3B8', marginTop: 8 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28, padding: 10 },
  logoutText: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
  deleteLink: { marginTop: 4, padding: 10 },
  deleteLinkText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
});

export default ShopStatusScreen;
