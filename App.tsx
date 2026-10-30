// App.tsx - entry point: loads fonts, wraps navigation, shows onboarding flow.
import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
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
import { getBoolean, removeItem, setBoolean, storageKeys } from './src/services/appStorage';
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

  const logout = useCallback(() => {
    setOnboardingDone(false);
    removeItem(storageKeys.onboardingDone);
    removeItem(storageKeys.chatHistory);
    removeItem(storageKeys.session);
    // An unsent acta draft has a worker's data: it must not outlive the session.
    removeItem(storageKeys.actaDraft);
    // The saved vacation balance belongs to this employee too.
    removeItem(storageKeys.vacationBalance);
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
      <NavigationContainer>
        {onboardingDone ? <DonePlaceholder onLogout={logout} /> : <OnboardingNavigator onFinished={finishOnboarding} />}
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
