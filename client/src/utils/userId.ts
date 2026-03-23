import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const USER_ID_KEY = 'careerality_user_id';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedUserId: string | null = null;

export async function getUserId(): Promise<string> {
  if (cachedUserId) {
    return cachedUserId;
  }

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) {
      cachedUserId = generateUUID();
      return cachedUserId;
    }
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
      userId = generateUUID();
      localStorage.setItem(USER_ID_KEY, userId);
    }
    cachedUserId = userId;
    return cachedUserId;
  }

  try {
    let userId = await AsyncStorage.getItem(USER_ID_KEY);
    if (!userId) {
      userId = generateUUID();
      await AsyncStorage.setItem(USER_ID_KEY, userId);
    }
    cachedUserId = userId;
    return cachedUserId;
  } catch {
    cachedUserId = generateUUID();
    return cachedUserId;
  }
}
