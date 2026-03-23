import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface OccupationIcon {
  iconName: IconName;
  color: string;
}

const occupationIconMap: Record<string, OccupationIcon> = {
  'Architecture and Engineering': {
    iconName: 'ruler-square-compass',
    color: '#5C6BC0',
  },
  'Arts and Design': {
    iconName: 'palette',
    color: '#EC407A',
  },
  'Building and Grounds Cleaning': {
    iconName: 'broom',
    color: '#26A69A',
  },
  'Business and Financial': {
    iconName: 'briefcase',
    color: '#42A5F5',
  },
  'Community and Social Service': {
    iconName: 'account-group',
    color: '#FF7043',
  },
  'Computer and Information Technology': {
    iconName: 'laptop',
    color: '#29B6F6',
  },
  'Construction and Extraction': {
    iconName: 'hammer',
    color: '#FFA726',
  },
  'Education Training and Library': {
    iconName: 'school',
    color: '#AB47BC',
  },
  'Entertainment and Sports': {
    iconName: 'trophy',
    color: '#EF5350',
  },
  'Farming Fishing and Forestry': {
    iconName: 'tree',
    color: '#66BB6A',
  },
  'Food Preparation and Serving': {
    iconName: 'silverware-fork-knife',
    color: '#FF8A65',
  },
  'Healthcare': {
    iconName: 'hospital-box',
    color: '#EC407A',
  },
  'Installation Maintenance and Repair': {
    iconName: 'wrench',
    color: '#78909C',
  },
  'Legal': {
    iconName: 'scale-balance',
    color: '#7E57C2',
  },
  'Life Physical and Social Science': {
    iconName: 'flask',
    color: '#26C6DA',
  },
  'Management': {
    iconName: 'account-tie',
    color: '#1E88E5',
  },
  'Math': {
    iconName: 'calculator',
    color: '#00897B',
  },
  'Media and Communication': {
    iconName: 'message-text',
    color: '#8D6E63',
  },
  'Military': {
    iconName: 'shield-star',
    color: '#546E7A',
  },
  'Personal Care and Service': {
    iconName: 'hand-heart',
    color: '#F06292',
  },
  'Production': {
    iconName: 'factory',
    color: '#8D6E63',
  },
  'Protective Service': {
    iconName: 'shield-check',
    color: '#EF5350',
  },
  'Sales': {
    iconName: 'cart',
    color: '#FFA000',
  },
  'Transportation and Material Moving': {
    iconName: 'truck',
    color: '#795548',
  },
};

const fallbackIcon: OccupationIcon = {
  iconName: 'briefcase-outline',
  color: '#78909C',
};

export function getOccupationIcon(groupName: string): OccupationIcon {
  return occupationIconMap[groupName] ?? fallbackIcon;
}

export { occupationIconMap };
