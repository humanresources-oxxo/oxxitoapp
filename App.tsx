// App.tsx - entry point: loads fonts, wraps navigation, shows onboarding flow.
import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { OnboardingNavigator, DonePlaceholder } from './src/navigation/OnboardingNavigator';
import { getBoolean, setBoolean, storageKeys } from './src/services/appStorage';
import { cerrarSesion } from './src/services/sesion';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { colors } from './src/theme/tokens';

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    let active = true;

    getBoolean(storageKeys.onboardingDone).then((saved) => {
      if (!active) return;
      setOnboardingDone(saved);
      setSessionLoaded(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const finishOnboarding = useCallback(() => {
    setOnboardingDone(true);
    setBoolean(storageKeys.onboardingDone, true);
  }, []);

  const logout = useCallback(async () => {
    setOnboardingDone(false);
    // Forgets everything saved for this employee (session, key, chat history,
    // read avisos, acta draft, vacation balance...) and ends the session key
    // on the server. A slow network must not hold the logout: 3 s at most.
    await Promise.race([cerrarSesion().catch(() => {}), new Promise((listo) => setTimeout(listo, 3000))]);
    // On the web, reloading also drops what the screens keep in memory
    // (estructura, vacaciones, CCT, DILOS, cuota, aviso images), so the next
    // person on a shared phone starts from zero.
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
  }, []);

  if (!fontsLoaded || !sessionLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.oxRed} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {/* On the web React Navigation names the browser tab after the screen
          ("undefined" for screens without a title): always Conoxxo. */}
      <NavigationContainer documentTitle={{ formatter: () => 'Conoxxo' }}>
        <ErrorBoundary>
          {onboardingDone ? <DonePlaceholder onLogout={logout} /> : <OnboardingNavigator onFinished={finishOnboarding} />}
        </ErrorBoundary>
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
