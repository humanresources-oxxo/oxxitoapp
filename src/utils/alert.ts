// src/utils/alert.ts
// react-native-web's Alert.alert is a no-op, so fall back to window.alert on web.
import { Alert, Platform } from 'react-native';

export const showAlert: (title: string, message: string) => void =
  Platform.OS === 'web' ? (title, message) => window.alert(`${title}\n\n${message}`) : Alert.alert;
