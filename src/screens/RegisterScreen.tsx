// src/screens/RegisterScreen.tsx
// First-login PIN creation for an employee already in the real roster
// (no free-text name entry — the name comes from the roster lookup).
import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StepsHeader } from '../components/StepsHeader';
import { OxField, OxLabel, OxHint } from '../components/OxField';
import { PinDots } from '../components/PinDots';
import { OxKeypad } from '../components/OxKeypad';
import { OxButton } from '../components/OxButton';
import { Icon } from '../components/Icon';
import { useOnboarding } from '../context/OnboardingContext';
import { setInitialPin } from '../services/auth';
import { colors, type } from '../theme/tokens';

export function RegisterScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const { empNum, verifiedName, regPin, setRegPin } = useOnboarding();
  const len = regPin.length;
  const ready = len === 4;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onKey = (k: string) => {
    if (len < 4) setRegPin(regPin + k);
  };
  const onDel = () => setRegPin(regPin.slice(0, -1));

  const handleCreate = async () => {
    if (!ready || loading) return;
    setLoading(true);
    setError('');
    try {
      await setInitialPin(empNum, regPin);
      onContinue();
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : '';
      setError(
        message.includes('pin_already_set')
          ? 'Este número ya tiene un PIN. Usa "Inicia sesión".'
          : 'No pudimos crear tu PIN. Intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { paddingTop: Platform.OS === 'ios' ? 8 : 4 }]}>
        <StepsHeader active={2} onBack={onBack} />

        <View style={styles.head}>
          <Text style={styles.kicker}>Primer ingreso</Text>
          <Text style={styles.title}>Crea tu PIN</Text>
          <Text style={styles.sub}>
            {verifiedName ? `Hola, ${verifiedName}. ` : ''}Este es tu primer ingreso a Conoxxo, crea un PIN de 4
            dígitos para proteger tu cuenta.
          </Text>
        </View>

        <View style={styles.fields}>
          <OxField icon="user" label="Nombre" value={verifiedName} locked />
          <OxField icon="badge" label="Número de empleado" value={empNum} locked tail="Verificado" />
          <View>
            <OxLabel>Crea tu PIN de acceso</OxLabel>
            <View style={{ paddingVertical: 6, paddingHorizontal: 2 }}>
              <PinDots length={len} total={4} />
            </View>
            <OxHint>Usarás este PIN cada vez que ingreses a Conoxxo.</OxHint>
            {error ? <OxHint>{error}</OxHint> : null}
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 8 }} />

        <OxKeypad onKey={onKey} onDel={onDel} />
      </View>

      <SafeAreaView edges={['bottom']} style={styles.cta}>
        <OxButton
          disabled={!ready || loading}
          onPress={handleCreate}
          icon={loading ? <ActivityIndicator color="#fff" /> : <Icon name="arrowR" size={19} color="#fff" />}
        >
          Crear PIN
        </OxButton>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
  },
  head: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 6,
  },
  kicker: {
    ...type.eyebrow,
    color: colors.oxRed,
    marginBottom: 10,
  },
  title: {
    ...type.title,
    color: colors.ink,
  },
  sub: {
    ...type.body,
    color: colors.ink2,
    marginTop: 10,
    maxWidth: 300,
  },
  fields: {
    paddingHorizontal: 24,
    paddingTop: 18,
    gap: 16,
  },
  cta: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});
