import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { colors, spacing } from '../constants/theme';

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drawerTitle}>Career ROI</Text>
        <Text style={styles.drawerSubtitle}>Career Investment Calculator</Text>
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
  } as ViewStyle,
  drawerHeader: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xxl + 30,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  } as ViewStyle,
  drawerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  } as TextStyle,
  drawerSubtitle: {
    fontSize: 14,
    color: colors.text.light,
    marginTop: spacing.xs,
  } as TextStyle,
});
