import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useTheme } from '../hooks/useTheme';
import { GIT_COMMIT_PREFIX } from '../constants/version';
import * as Updates from 'expo-updates';

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const theme = useTheme();
  
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <View style={[styles.drawerHeader, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.drawerTitle}>Careerality OTA-TEST</Text>
        <Text style={[styles.drawerSubtitle, { color: theme.colors.text.light }]}>Career Investment Calculator</Text>
      </View>
      <View style={styles.drawerBody}>
        <DrawerItemList {...props} />
      </View>
      <View style={[styles.drawerFooter, { borderTopColor: theme.colors.border }]}>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Build: {GIT_COMMIT_PREFIX}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Channel: {Updates.channel || 'none'}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Runtime: {Updates.runtimeVersion || 'unknown'}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Update: {Updates.updateId || 'none'}</Text>
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  drawerContent: {
    flexGrow: 1,
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
  drawerBody: {
    flex: 1,
  } as ViewStyle,
  drawerFooter: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  } as ViewStyle,
  commitText: {
    fontSize: 12,
  } as TextStyle,
});
