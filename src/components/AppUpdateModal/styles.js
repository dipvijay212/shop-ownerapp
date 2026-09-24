import { StyleSheet, Dimensions } from 'react-native';
import { theme } from '../../theme';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Soft Update Floating Modal Dialog Styles
  softOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  softBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  softDialogCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  softCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  softDialogContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  softDialogScroll: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  softActionsRow: {
    width: '100%',
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    gap: 10,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.l || 24,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    paddingVertical: theme.spacing.l || 24,
  },

  // Category Tag Pills
  softTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 20,
  },
  softTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.6,
  },
  hardTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 20,
  },
  hardTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.6,
  },

  // Illustration Graphic
  illustrationOuterRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  illustrationCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  illustrationBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Typography
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 16,
    paddingHorizontal: 8,
  },

  // Version Badge
  versionBadgeContainer: {
    marginBottom: 24,
  },
  versionBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 100,
    alignSelf: 'center',
  },
  softVersionBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  softVersionText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  hardVersionBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  hardVersionText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '700',
  },

  // Cards
  softCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hardCard: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  softCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  hardCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  cardList: {
    gap: 12,
  },
  cardListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    marginTop: 7,
  },
  cardListText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },

  // Actions Container (Bottom Pinned Bar)
  actionsContainer: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    height: 54,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    elevation: 3,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
});
