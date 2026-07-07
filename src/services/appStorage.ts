// src/services/appStorage.ts
// Storage adapter backed by AsyncStorage — works on iOS/Android and web (it
// ships its own web implementation), so no platform branching is needed here.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const storageKeys = {
  onboardingDone: 'oxxito:onboardingDone',
  chatHistory: 'oxxito:chatHistory',
  noticeReadState: 'oxxito:noticeReadState',
  profilePrefs: 'oxxito:profilePrefs',
  session: 'oxxito:session',
  chatQuestionCount: 'oxxito:chatQuestionCount',
};

export async function getBoolean(key: string) {
  return (await AsyncStorage.getItem(key)) === 'true';
}

export async function setBoolean(key: string, value: boolean) {
  await AsyncStorage.setItem(key, value ? 'true' : 'false');
}

export async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJson<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeItem(key: string) {
  await AsyncStorage.removeItem(key);
}
