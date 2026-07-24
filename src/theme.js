export const theme = {
  colors: {
    primary: '#16A34A', // Primary Green
    primaryDark: '#15803D', // Dark Green
    primaryLight: '#DCFCE7', // Light Green
    background: '#F8FAFC', // Slate background
    surface: '#FFFFFF', // Card background
    white: '#FFFFFF',
    black: '#0F172A',
    border: '#E2E8F0', // Light slate border
    text: '#0F172A', // Primary text
    textDark: '#0F172A', // Primary text
    textLight: '#64748B', // Secondary text
    textSecondary: '#64748B',
    error: '#EF4444', // Danger
    danger: '#EF4444',
    warning: '#F59E0B', // Warning
    success: '#22C55E', // Success
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 40,
  },
  roundness: 20, // 20 as specified
  roundnessLg: 24,
  shadows: {
    soft: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    medium: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    premium: {
      shadowColor: '#16A34A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 6,
    }
  },
  typography: {
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: '#0F172A',
    },
    subtitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#0F172A',
    },
    body: {
      fontSize: 15,
      color: '#0F172A',
      lineHeight: 22,
    },
    caption: {
      fontSize: 12,
      color: '#64748B',
    },
    button: {
      fontSize: 16,
      fontWeight: '700',
    },
  },
  controls: {
    touchTargetHeight: 52,
  },
};
