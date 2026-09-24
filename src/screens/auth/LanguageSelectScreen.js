import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Globe, ArrowRight, Check, Sparkles } from 'lucide-react-native';
import { theme } from '../../theme';
import { AuthContext } from '../../context/AuthContext';
import { SUPPORTED_LANGUAGES } from '../../constants/translations';
import { useTranslation } from '../../constants/translations';

const LANGUAGES = SUPPORTED_LANGUAGES;

export const LanguageSelectScreen = ({ route }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { appLanguage, setAppLanguage } = useContext(AuthContext);
  const [selectedLang, setSelectedLang] = useState(appLanguage || 'en');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  const isNewUser = route?.params?.isNewUser;
  const phone = route?.params?.phone;
  const authPayload = route?.params?.authPayload;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const selectedLanguageObj = LANGUAGES.find((l) => l.id === selectedLang) || LANGUAGES[0];

  const handleContinue = async () => {
    try {
      if (setAppLanguage) {
        await setAppLanguage(selectedLang);
      } else {
        await AsyncStorage.setItem('owner_preferred_language', selectedLang);
      }
    } catch (error) {
      console.log('Error saving language preference:', error);
    }

    if (isNewUser || authPayload) {
      navigation.navigate('RegisterShop', { phone, authPayload });
    } else {
      navigation.navigate('Login');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <Animated.View
        style={[
          styles.contentContainer,
          {
            paddingTop: Platform.OS === 'ios' ? insets.top : 0,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Dynamic Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <Globe color={theme.colors.primary} size={30} />
            <View style={styles.sparkleBadge}>
              <Sparkles color="#F59E0B" size={14} />
            </View>
          </View>
          <Text style={styles.titleText}>{selectedLanguageObj.greeting}</Text>
          <Text style={styles.subtitleText}>{selectedLanguageObj.subGreeting}</Text>
        </View>

        {/* Stacked Large Cards for 3 Languages */}
        <ScrollView
          style={styles.scrollSection}
          contentContainerStyle={styles.cardsContainer}
          showsVerticalScrollIndicator={false}
        >
          {LANGUAGES.map((item) => {
            const isSelected = item.id === selectedLang;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                activeOpacity={0.85}
                onPress={() => setSelectedLang(item.id)}
              >
                {/* Symbol Emblem */}
                <View style={[styles.symbolBox, isSelected && styles.symbolBoxSelected]}>
                  <Text style={[styles.symbolText, isSelected && styles.symbolTextSelected]}>
                    {item.symbol}
                  </Text>
                </View>

                {/* Language Texts */}
                <View style={styles.cardContent}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.nativeText, isSelected && styles.nativeTextSelected]}>
                      {item.nativeName}
                    </Text>
                    <Text style={styles.englishText}> ({item.name})</Text>

                    {item.badge ? (
                      <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                        <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.descriptionText}>{item.description}</Text>
                </View>

                {/* Radio Button Indicator */}
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sticky Bottom Action */}
        <View style={[styles.footerSection, { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom + 12, 24) : 20 }]}>
          <TouchableOpacity
            style={styles.continueButton}
            activeOpacity={0.85}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>
              {selectedLanguageObj.continueText}
            </Text>
            <ArrowRight color="#FFFFFF" size={22} style={styles.arrowIcon} />
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            {t('changeLanguageLater')}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  contentContainer: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#B9F8D3',
    ...theme.shadows.soft,
  },
  sparkleBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FEF3C7',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  titleText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  scrollSection: {
    flex: 1,
  },
  cardsContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...theme.shadows.soft,
  },
  cardSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: theme.colors.primary,
    ...theme.shadows.medium,
  },
  symbolBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  symbolBoxSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#B9F8D3',
  },
  symbolText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#475569',
  },
  symbolTextSelected: {
    color: '#15803D',
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  nativeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  nativeTextSelected: {
    color: '#15803D',
  },
  englishText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 6,
  },
  badge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
  },
  badgeSelected: {
    backgroundColor: '#DCFCE7',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  badgeTextSelected: {
    color: '#15803D',
  },
  descriptionText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  footerSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    ...theme.shadows.soft,
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
    height: 58,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    ...theme.shadows.premium,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  arrowIcon: {
    marginLeft: 4,
  },
  footerNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
});

export default LanguageSelectScreen;
