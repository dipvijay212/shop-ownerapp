import React, { useContext } from 'react';
import { Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { theme } from '../theme';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../constants/translations';

/**
 * Shown right after a deletion request locks the account. Rendered by
 * RootNavigator in place of the auth stack, because the session is already
 * gone server-side — no authed screen could stay mounted to show it.
 */
export const DeletionSubmittedScreen = () => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { accountNotice, clearAccountNotice } = useContext(AuthContext);
  const bottomPad = Math.max(insets.bottom + 24, Platform.OS === 'android' ? 40 : 24);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F9F8" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <View style={styles.icon}>
          <Lock color="#B45309" size={32} />
        </View>
        <Text style={styles.title}>{t('delSubmittedTitle', 'Deletion Request Submitted')}</Text>
        {accountNotice?.requestNo ? (
          <Text style={styles.requestNo}>{t('delRequestNo', 'Request {no}', { no: accountNotice.requestNo })}</Text>
        ) : null}
        <Text style={styles.body}>{t('delSubmittedBody1', 'Your account deletion request has been submitted for review.')}</Text>
        <Text style={styles.body}>{t('delSubmittedBody2', 'Your account is temporarily unavailable while the request is being reviewed. Your shop has been taken offline.')}</Text>
        <Text style={styles.body}>{t('delSubmittedBody3', 'Our team may contact you if needed.')}</Text>
        <TouchableOpacity style={styles.btn} onPress={clearAccountNotice}>
          <Text style={styles.btnText}>{t('delReturnLogin', 'Return to Login')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9F8' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  icon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEF3C7',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 8 },
  requestNo: { fontSize: 13, fontWeight: '700', color: '#64748B', textAlign: 'center', marginBottom: 16 },
  body: { fontSize: 15, color: '#475569', lineHeight: 22, textAlign: 'center', marginBottom: 12 },
  btn: {
    marginTop: 20, height: 54, borderRadius: 27, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center', ...theme.shadows.soft,
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

export default DeletionSubmittedScreen;
