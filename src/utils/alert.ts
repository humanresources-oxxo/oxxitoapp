// src/utils/alert.ts
// react-native-web's Alert.alert is a no-op, so fall back to window.alert on web.
import { Alert, Platform } from 'react-native';

export const showAlert: (title: string, message: string) => void =
  Platform.OS === 'web' ? (title, message) => window.alert(`${title}\n\n${message}`) : Alert.alert;

// Yes/no question; resolves true when confirmed. window.confirm on web.
export function confirmAlert(title: string, message: string, confirmText = 'Aceptar'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  );
}
