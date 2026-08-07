// src/navigation/OnboardingNavigator.tsx
// Single-stack navigator for onboarding: splash -> welcome -> login -> verify -> register -> permissions.
import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingProvider } from '../context/OnboardingContext';
import { SplashScreen } from '../screens/SplashScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { VerifyScreen } from '../screens/VerifyScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';
import { MainTabsNavigator } from './MainTabsNavigator';

export type OnboardingStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Verify: undefined;
  Register: undefined;
  Permissions: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

function DonePlaceholder({ onLogout }: { onLogout: () => void }) {
  return <MainTabsNavigator onLogout={onLogout} />;
}

export function OnboardingNavigator({ onFinished }: { onFinished: () => void }) {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  return (
    <OnboardingProvider>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="Welcome">
          {({ navigation }) => <WelcomeScreen onContinue={() => navigation.navigate('Login')} />}
        </Stack.Screen>
        <Stack.Screen name="Login">
          {({ navigation }) => (
            <LoginScreen
              onBack={() => navigation.navigate('Welcome')}
              onContinue={() => navigation.navigate('Verify')}
              onRegister={() => navigation.navigate('Register')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Verify">
          {({ navigation }) => (
            <VerifyScreen onBack={() => navigation.navigate('Login')} onContinue={() => navigation.navigate('Permissions')} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Register">
          {({ navigation }) => (
            <RegisterScreen
              onBack={() => navigation.navigate('Login')}
              onContinue={() => navigation.navigate('Permissions')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Permissions">
          {({ navigation }) => (
            <PermissionsScreen onBack={() => navigation.navigate('Verify')} onContinue={onFinished} />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </OnboardingProvider>
  );
}

export { DonePlaceholder };


