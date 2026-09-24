import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CloudOff } from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import { theme } from '../theme';
import { useTranslation } from '../constants/translations';

/**
 * Shown when the owner is signed in but GET /owner/shop never answered, so the
 * app genuinely does not know which screen they belong on.
 *
 * The alternative — treating "no answer" as "no shop" — routes an owner with a
 * live shop into the onboarding wizard, which looks like data loss and offers
 * no way out. A retry is honest about what happened and recovers in one tap.
 */
export const ShopUnavailableScreen = () => {
  const { refreshShop, logout } = useContext(AuthContext);
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    setFailed(false);
    try {
      await refreshShop();
      // On success the navigator swaps this screen out on its own.
    } catch (e) {
      setFailed(true);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconBadge}>
        <CloudOff color={theme.colors.primary} size={32} />
      </View>

      <Text style={styles.title}>{t('shopUnavailableTitle', "Couldn't load your shop")}</Text>
      <Text style={styles.body}>
        {failed
          ? t('shopUnavailableRetryFailed', 'Still no response. Check your connection and try again.')
          : t('shopUnavailableBody', 'We could not reach the server. Your shop and data are safe.')}
      </Text>

      <TouchableOpacity
        style={[styles.retryBtn, retrying && styles.retryBtnDisabled]}
        onPress={handleRetry}
        disabled={retrying}
        activeOpacity={0.85}
      >
        {retrying ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.retryText}>{t('tryAgain', 'Try Again')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={logout} style={styles.logoutBtn} activeOpacity={0.7}>
        <Text style={styles.logoutText}>{t('logout', 'Log Out')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  retryBtnDisabled: {
    opacity: 0.7,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  logoutBtn: {
    marginTop: 18,
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
});

export default ShopUnavailableScreen;
