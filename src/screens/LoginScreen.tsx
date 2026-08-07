// src/screens/LoginScreen.tsx
// Ported from PLogin in screens-proto.jsx.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StepsHeader } from '../components/StepsHeader';
import { OxField, OxHint } from '../components/OxField';
import { OxKeypad } from '../components/OxKeypad';
import { OxButton } from '../components/OxButton';
import { Icon } from '../components/Icon';
import { useOnboarding } from '../context/OnboardingContext';
import { lookupEmployee } from '../services/auth';
import { colors, type } from '../theme/tokens';

const MAX = 10;
const MIN = 4;

export function LoginScreen({
  onBack,
  onContinue,
  onRegister,
}: {
  onBack: () => void;
  onContinue: () => void;
  onRegister: () => void;
}) {
  // Only numbers already in the roster can go anywhere — new hires are added
  // to the roster directly (by an admin), never self-registered from here.
  const { empNum, setEmpNum, setVerifiedName, setTienda, setPlaza, setPuesto, setCreatedAt } = useOnboarding();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const full = empNum.length >= MIN;

  const onKey = (k: string) => setEmpNum((empNum + k).slice(0, MAX));
  const onDel = () => setEmpNum(empNum.slice(0, -1));

  const handleContinue = async () => {
    if (!full || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await lookupEmployee(empNum);
      if (!result.exists) {
        setError('No encontramos ese número de empleado. Verifica tu gafete o contacta a Recursos Humanos.');
        return;
      }
      setVerifiedName(result.nombre ?? '');
      setTienda(result.tienda ?? '');
      setPlaza(result.plaza ?? '');
      setPuesto(result.puesto ?? '');
      setCreatedAt(result.createdAt ?? '');
      if (result.hasPin) {
        onContinue();
      } else {
        onRegister();
      }
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : '';
      setError(
        message.includes('rate_limited')
          ? 'Demasiados intentos. Espera un minuto e intenta de nuevo.'
          : 'No pudimos conectar. Revisa tu conexion e intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { paddingTop: Platform.OS === 'ios' ? 8 : 4 }]}>
        <StepsHeader active={0} onBack={onBack} />

        <View style={styles.head}>
          <Text style={styles.kicker}>Identificación</Text>
          <Text style={styles.title}>Inicia sesión</Text>
          <Text style={styles.sub}>Ingresa tu número de empleado para acceder a Oxxito.</Text>
        </View>

        <View style={styles.fields}>
          <OxField
            icon="badge"
            label="Número de empleado"
            value={empNum}
            placeholder="Ingresa tu número"
            focused
            tail={empNum.length ? `${empNum.length} díg.` : ''}
          />
          <OxHint>Lo encuentras en tu gafete o recibo de nómina. Puede tener hasta 10 dígitos.</OxHint>
          {error ? <OxHint>{error}</OxHint> : null}
        </View>

        <View style={{ flex: 1, minHeight: 8 }} />

        <OxKeypad onKey={onKey} onDel={onDel} />
      </View>

      <SafeAreaView edges={['bottom']} style={styles.cta}>
        <OxButton
          disabled={!full || loading}
          onPress={handleContinue}
          icon={loading ? <ActivityIndicator color="#fff" /> : <Icon name="arrowR" size={19} color="#fff" />}
        >
          Continuar
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
    maxWidth: 280,
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
