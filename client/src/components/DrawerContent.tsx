import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, Button, Alert, Platform } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useTheme } from '../hooks/useTheme';
import { GIT_COMMIT_PREFIX } from '../constants/version';
import { apiClient } from '../api/client';
import * as Updates from 'expo-updates';

const DELETE_CONFIRM_TITLE = 'Delete My Data';
const DELETE_CONFIRM_MESSAGE = 'This permanently deletes all of your swipe history. This cannot be undone.';

const confirmDelete = (): Promise<boolean> => {
  // react-native-web does not render Alert.alert, so fall back to window.confirm on web.
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${DELETE_CONFIRM_TITLE}\n\n${DELETE_CONFIRM_MESSAGE}`));
  }
  return new Promise((resolve) => {
    Alert.alert(DELETE_CONFIRM_TITLE, DELETE_CONFIRM_MESSAGE, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
};

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const theme = useTheme();
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const { currentlyRunning, isUpdateAvailable, isUpdatePending, isChecking, isDownloading, checkError, downloadError } = Updates.useUpdates();

  useEffect(() => {
    if (isUpdatePending) {
      Updates.reloadAsync();
    }
  }, [isUpdatePending]);

  const onDeleteMyData = async () => {
    const confirmed = await confirmDelete();
    if (!confirmed) return;
    try {
      await apiClient.deleteAllSwipes();
      setDeleteMessage('Your data has been deleted');
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : 'Failed to delete data');
    }
  };

  const onFetchUpdateAsync = async () => {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } else {
        Alert.alert('No update available');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <View style={[styles.drawerHeader, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.drawerTitle}>Careerality</Text>
        <Text style={[styles.drawerSubtitle, { color: theme.colors.text.light }]}>Career Investment Calculator</Text>
      </View>
      <View style={styles.drawerBody}>
        <DrawerItemList {...props} />
        <DrawerItem
          label="Delete My Data"
          labelStyle={{ color: theme.colors.error }}
          onPress={onDeleteMyData}
        />
        {deleteMessage && (
          <Text style={[styles.deleteMessage, { color: theme.colors.text.muted }]}>{deleteMessage}</Text>
        )}
      </View>
      {__DEV__ && (
      <View style={[styles.drawerFooter, { borderTopColor: theme.colors.border }]}>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Build: {GIT_COMMIT_PREFIX}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Channel: {Updates.channel || 'none'}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Runtime: {Updates.runtimeVersion || 'unknown'}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Update: {Updates.updateId || 'none'}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Enabled: {Updates.isEnabled ? 'yes' : 'no'}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Embedded: {currentlyRunning.isEmbeddedLaunch ? 'yes' : 'no'}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Checking: {isChecking ? 'yes' : 'no'}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>Downloading: {isDownloading ? 'yes' : 'no'}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>UpdateAvail: {isUpdateAvailable ? 'yes' : 'no'}</Text>
        <Text style={[styles.commitText, { color: theme.colors.text.muted }]}>UpdatePend: {isUpdatePending ? 'yes' : 'no'}</Text>
        {checkError && <Text style={[styles.commitText, { color: 'red' }]}>CheckErr: {checkError.message}</Text>}
        {downloadError && <Text style={[styles.commitText, { color: 'red' }]}>DLErr: {downloadError.message}</Text>}
        <View style={styles.buttonContainer}>
          <Button title="Check for Update" onPress={onFetchUpdateAsync} />
        </View>
      </View>
      )}
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
  deleteMessage: {
    fontSize: 14,
    marginHorizontal: 20,
    marginTop: 8,
  } as TextStyle,
  buttonContainer: {
    marginTop: 8,
  } as ViewStyle,
});
