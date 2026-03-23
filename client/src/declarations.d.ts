declare module 'react-native-range-slider';
declare module '@expo/vector-icons' {
  import type { ComponentType } from 'react';

  interface IconProps {
    name: string;
    size?: number;
    color?: string;
  }

  export const MaterialCommunityIcons: ComponentType<IconProps> & {
    glyphMap: Record<string, number>;
  };

  export const AntDesign: ComponentType<IconProps>;
  export const Entypo: ComponentType<IconProps>;
  export const EvilIcons: ComponentType<IconProps>;
  export const Feather: ComponentType<IconProps>;
  export const FontAwesome: ComponentType<IconProps>;
  export const FontAwesome5: ComponentType<IconProps>;
  export const Fontisto: ComponentType<IconProps>;
  export const Foundation: ComponentType<IconProps>;
  export const Ionicons: ComponentType<IconProps>;
  export const MaterialIcons: ComponentType<IconProps>;
  export const Octicons: ComponentType<IconProps>;
  export const SimpleLineIcons: ComponentType<IconProps>;
  export const Zocial: ComponentType<IconProps>;
}