import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExternalLink, WifiOff, X } from 'lucide-react-native';
import { theme } from '../theme';
import { useTranslation } from '../constants/translations';
import { useLegalDoc } from '../hooks/useLegalDoc';

const TITLE_KEY = { privacy: 'privacyPolicyLabel', terms: 'termsConditions' };

const openUrl = (url) => Linking.openURL(url).catch(() => {});

// A section's content is a list of blocks. These four are the ones the site
// uses today; anything else is skipped, so the site can add a new block type
// without breaking builds already on people's phones.
const Block = ({ block }) => (
  <View style={styles.block}>
    {typeof block.subtitle === 'string' && <Text style={styles.subtitle}>{block.subtitle}</Text>}
    {typeof block.text === 'string' && <Text style={styles.body}>{block.text}</Text>}
    {Array.isArray(block.items) &&
      block.items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Text style={styles.bullet}>{'•'}</Text>
          <Text style={[styles.body, styles.bulletText]}>{item}</Text>
        </View>
      ))}
    {typeof block.details === 'string' && <Text style={styles.details}>{block.details}</Text>}
  </View>
);

const ContactValue = ({ item }) => {
  if (Array.isArray(item.links)) {
    return item.links.map((link, i) => (
      <Text key={link.href}>
        {i > 0 && ', '}
        <Text style={styles.link} onPress={() => openUrl(link.href)}>
          {link.value}
        </Text>
      </Text>
    ));
  }
  if (item.href) {
    return (
      <Text style={styles.link} onPress={() => openUrl(item.href)}>
        {item.value}
      </Text>
    );
  }
  return item.value;
};

const Document = ({ doc, offline, t }) => {
  const { contact } = doc;
  return (
    <>
      {offline && (
        <View style={styles.offlineBanner}>
          <WifiOff color="#92400E" size={16} />
          <Text style={styles.offlineText}>{t('legalOfflineCopy')}</Text>
        </View>
      )}

      <Text style={styles.docTitle}>{doc.title}</Text>
      <Text style={styles.updated}>{t('legalLastUpdated', { date: doc.lastUpdated })}</Text>

      {doc.intro.map((p) => (
        <Text key={p} style={[styles.body, styles.paragraph]}>
          {p}
        </Text>
      ))}

      {doc.sections.map((section, index) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{`${index + 1}. ${section.title}`}</Text>
          {(section.content || []).map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </View>
      ))}

      {contact && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{`${doc.sections.length + 1}. ${contact.title}`}</Text>
          {!!contact.text && <Text style={[styles.body, styles.paragraph]}>{contact.text}</Text>}
          {(contact.items || []).map((item) => (
            <View key={item.label} style={styles.bulletRow}>
              <Text style={styles.bullet}>{'•'}</Text>
              <Text style={[styles.body, styles.bulletText]}>
                <Text style={styles.contactLabel}>{item.label}: </Text>
                <ContactValue item={item} />
              </Text>
            </View>
          ))}
          {(contact.notes || []).map((note) => (
            <Text key={note} style={[styles.body, styles.paragraph, styles.note]}>
              {note}
            </Text>
          ))}
        </View>
      )}

      {!!doc.webUrl && (
        <TouchableOpacity
          style={styles.webLink}
          onPress={() => openUrl(doc.webUrl)}
          activeOpacity={0.7}
          accessibilityRole="link"
        >
          <Text style={styles.webLinkText}>{t('legalViewOnWebsite')}</Text>
          <ExternalLink color={theme.colors.primary} size={16} />
        </TouchableOpacity>
      )}
    </>
  );
};

/**
 * Privacy Policy / Terms & Conditions, rendered natively from the website's
 * data (see src/api/endpoints/legal.js). kind: 'privacy' | 'terms'.
 */
const LegalSheet = ({ visible, kind, onClose }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom + 20, Platform.OS === 'android' ? 36 : 24);
  const { doc, offline, loading, failed, retry } = useLegalDoc(kind, visible);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: bottomPadding }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{t(TITLE_KEY[kind])}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
              <X color="#333" size={24} />
            </TouchableOpacity>
          </View>

          {doc ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Document doc={doc} offline={offline} t={t} />
            </ScrollView>
          ) : (
            <View style={styles.state}>
              {failed ? (
                <>
                  <WifiOff color={theme.colors.textLight} size={32} />
                  <Text style={styles.stateText}>{t('legalLoadFailed')}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={() => retry()} activeOpacity={0.8}>
                    <Text style={styles.retryText}>{t('legalRetry')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <ActivityIndicator color={theme.colors.primary} size="large" />
                  {loading && <Text style={styles.stateText}>{t('legalLoading')}</Text>}
                </>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  state: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  stateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  offlineText: {
    marginLeft: 8,
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  updated: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 12,
    color: theme.colors.textLight,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  block: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  paragraph: {
    marginBottom: 8,
  },
  note: {
    marginTop: 8,
  },
  details: {
    marginTop: 4,
    fontSize: 13,
    color: theme.colors.textLight,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  bulletRow: {
    flexDirection: 'row',
    paddingLeft: 4,
    marginTop: 2,
  },
  bullet: {
    width: 16,
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.primary,
  },
  bulletText: {
    flex: 1,
  },
  contactLabel: {
    fontWeight: '700',
    color: '#334155',
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  webLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: '#F0FDF4',
  },
  webLinkText: {
    marginRight: 6,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});

export default LegalSheet;
