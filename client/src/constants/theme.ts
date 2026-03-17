export const colors = {
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  primaryDark: '#4338CA',
  
  background: '#F3F4F6',
  surface: '#FFFFFF',
  
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    light: '#C7D2FE',
    muted: '#9CA3AF',
  },
  
  success: '#059669',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#DC2626',
  
  border: '#E5E7EB',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 30,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  title: {
    fontSize: 32,
    fontWeight: 'bold' as const,
  },
  subtitle: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  body: {
    fontSize: 15,
  },
  caption: {
    fontSize: 13,
  },
  small: {
    fontSize: 12,
  },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
};
