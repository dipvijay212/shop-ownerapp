import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Smartphone,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  PackageCheck,
  X,
} from 'lucide-react-native';
import { theme } from '../../theme';
import { styles } from './styles';
import { openStore } from '../../utils/openStore';
import { UPDATE_TYPES } from '../../services/appUpdateService';
import { useTranslation } from '../../constants/translations';

/**
 * Modern App Update component:
 * - Hard Update: Full screen view (transparent={false}), cannot be dismissed.
 * - Soft Update: Floating card dialog over dark backdrop (transparent={true}), can be dismissed.
 */
export const AppUpdateModal = ({
  visible = false,
  type = UPDATE_TYPES.SOFT_UPDATE,
  latestVersion = '2.0.0',
  minimumVersion = '1.5.0',
  title: customTitle,
  message: customMessage,
  onDismiss,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHardUpdate = type === UPDATE_TYPES.HARD_UPDATE || type === 'hard';

  const handleUpdatePress = () => {
    if (onUpdate) {
      onUpdate();
    } else {
      openStore();
    }
  };

  const handleDismissPress = () => {
    if (onDismiss && !isHardUpdate) {
      onDismiss();
    }
  };

  // Header Title & Subtitle logic
  const displayTitle = customTitle || t(isHardUpdate ? 'updHardTitle' : 'updSoftTitle');
  const displayDescription = customMessage || t(isHardUpdate ? 'updHardDesc' : 'updSoftDesc');

  // Soft Update Dialog View (Floating Card Modal)
  if (!isHardUpdate) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleDismissPress}
      >
        <View style={styles.softOverlay}>
          <TouchableOpacity
            style={styles.softBackdrop}
            activeOpacity={1}
            onPress={handleDismissPress}
          />

          <View style={styles.softDialogCard}>
            {/* Top Close Button */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleDismissPress}
              activeOpacity={0.7}
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>

            <View style={styles.softDialogContent}>
              {/* Illustration Graphic Circle */}
              <View style={styles.illustrationOuterRing}>
                <View style={styles.illustrationCircle}>
                  <Smartphone size={40} color={theme.colors.primary} />
                  <View style={styles.illustrationBadge}>
                    <Sparkles size={13} color="#FFFFFF" />
                  </View>
                </View>
              </View>

              {/* Title & Description */}
              <Text style={styles.title}>{displayTitle}</Text>
              <Text style={styles.description}>{displayDescription}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.softActionsRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={handleUpdatePress}
              >
                <Text style={styles.primaryButtonText}>{t('updNowBtn')}</Text>
                <ArrowRight size={20} color={theme.colors.white} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.7}
                onPress={handleDismissPress}
              >
                <Text style={styles.secondaryButtonText}>{t('updLaterBtn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Hard Update View (Full Screen Modal)
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.screenContainer, { paddingTop: Math.max(insets.top, 24) }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.contentContainer}>
            {/* Top Category Tag Pill */}
            <View style={styles.hardTagPill}>
              <ShieldCheck size={14} color="#15803D" />
              <Text style={styles.hardTagText}>{t('updActionRequired')}</Text>
            </View>

            {/* Illustration Graphic Circle */}
            <View style={styles.illustrationOuterRing}>
              <View style={styles.illustrationCircle}>
                <ShieldCheck size={44} color={theme.colors.primary} />
                <View style={styles.illustrationBadge}>
                  <Sparkles size={14} color="#FFFFFF" />
                </View>
              </View>
            </View>

            {/* Title & Description */}
            <Text style={styles.title}>{displayTitle}</Text>
            <Text style={styles.description}>{displayDescription}</Text>

            {/* Version Pill */}
            <View style={styles.versionBadgeContainer}>
              <View style={[styles.versionBadge, styles.hardVersionBadge]}>
                <Text style={styles.hardVersionText}>
                  {t('updMinVersion', { version: minimumVersion })}
                </Text>
              </View>
            </View>

            {/* Structured Card Section */}
            <View style={styles.hardCard}>
              <View style={styles.cardHeader}>
                <ShieldCheck size={18} color={theme.colors.primary} />
                <Text style={styles.hardCardTitle}>{t('updWhyRequired')}</Text>
              </View>
              <View style={styles.cardList}>
                <View style={styles.cardListItem}>
                  <CheckCircle2 size={16} color={theme.colors.primary} />
                  <Text style={styles.cardListText}>
                    <Text style={styles.boldText}>{t('updDataSecurityLabel')}</Text>
                    {t('updDataSecurityBody')}
                  </Text>
                </View>
                <View style={styles.cardListItem}>
                  <CheckCircle2 size={16} color={theme.colors.primary} />
                  <Text style={styles.cardListText}>
                    <Text style={styles.boldText}>{t('updSystemSyncLabel')}</Text>
                    {t('updSystemSyncBody')}
                  </Text>
                </View>
                <View style={styles.cardListItem}>
                  <CheckCircle2 size={16} color={theme.colors.primary} />
                  <Text style={styles.cardListText}>
                    <Text style={styles.boldText}>{t('updStabilityLabel')}</Text>
                    {t('updStabilityBody')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Fixed Action Bar with Safe Area Insets */}
        <View
          style={[
            styles.actionsContainer,
            { paddingBottom: Math.max(insets.bottom + 16, Platform.OS === 'android' ? 32 : 24) },
          ]}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={handleUpdatePress}
          >
            <Text style={styles.primaryButtonText}>{t('updNowBtn')}</Text>
            <ArrowRight size={20} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
