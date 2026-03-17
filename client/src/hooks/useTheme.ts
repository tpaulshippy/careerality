import { useColorScheme } from 'react-native';
import { lightColors, darkColors, spacing, borderRadius, typography, shadows } from '../constants/theme';

export type ColorScheme = 'light' | 'dark';

export interface Theme {
  colors: typeof lightColors;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  typography: typeof typography;
  shadows: typeof shadows;
  isDark: boolean;
}

export const useTheme = (): Theme => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    colors: isDark ? darkColors : lightColors,
    spacing,
    borderRadius,
    typography,
    shadows,
    isDark,
  };
};
