import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getOccupationIcon } from '../constants/occupationIcons';

interface OccupationIconBadgeProps {
  groupName: string;
  size?: number;
}

export const OccupationIconBadge: React.FC<OccupationIconBadgeProps> = ({
  groupName,
  size = 40,
}) => {
  const { iconName, color } = getOccupationIcon(groupName);
  const iconSize = Math.round(size * 0.55);

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
          backgroundColor: color + '26',
        },
      ]}
    >
      <MaterialCommunityIcons name={iconName} size={iconSize} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
