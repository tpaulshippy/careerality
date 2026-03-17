import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useTheme } from '../hooks/useTheme';

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const theme = useTheme();
  
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <View style={[styles.drawerHeader, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.drawerTitle}>Career ROI</Text>
        <Text style={[styles.drawerSubtitle, { color: theme.colors.text.light }]}>Career Investment Calculator</Text>
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
    paddingTop: 54,
    paddingBottom: 30,
    paddingHorizontal: 20,
  } as ViewStyle,
  drawerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  } as TextStyle,
  drawerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  } as TextStyle,
});
