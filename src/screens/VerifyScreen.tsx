// src/screens/VerifyScreen.tsx
// Ported from PVerify in screens-proto.jsx.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StepsHeader } from '../components/StepsHeader';
import { BearAvatar } from '../components/Bear';
import { PinDots } from '../components/PinDots';
import { OxKeypad } from '../components/OxKeypad';
import { OxButton, GhostAccent } from '../components/OxButton';
import { Icon } from '../components/Icon';
import { useOnboarding } from '../context/OnboardingContext';
import { verifyPin } from '../services/auth';
import { fetchContacts } from '../services/directory';
import { showAlert } from '../utils/alert';
import { colors, type } from '../theme/tokens';

function minutesLeft(lockedUntil: string) {
  return Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000));
}

export function VerifyScreen({
  onBack,
  onContinue,
  onMustSetNewPin,
}: {
  onBack: () => void;
  onContinue: () => void;
  onMustSetNewPin: () => void;
}) {
  const { empNum, pin, setPin, verifiedName, setMustSetNewPin } = useOnboarding();
  const len = pin.length;
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lockedMessage, setLockedMessage] = useState('');

  const onKey = (k: string) => {
    if (len >= 4 || checking || lockedMessage) return;
    const next = pin + k;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      setChecking(true);
      verifyPin(empNum, next)
        .then((result) => {
          if (result.status === 'ok') {
            if (result.pinIsTemporary) {
              setMustSetNewPin(true);
              onMustSetNewPin();
            } else {
              onContinue();
            }
            return;
          }
          if (result.status === 'locked') {
            setLockedMessage(`Cuenta bloqueada por varios intentos fallidos. Intenta de nuevo en ${minutesLeft(result.lockedUntil)} min.`);
          } else {
            setError(true);
          }
          setTimeout(() => setPin(''), 420);
        })
        .catch(() => {
          setError(true);
          setTimeout(() => setPin(''), 420);
        })
        .finally(() => setChecking(false));
    }
  };

  const onDel = () => {
    setError(false);
    setPin(pin.slice(0, -1));
  };

  const recoverPin = () => {
    fetchContacts()
      .then((contacts) => {
        const rh = contacts.find((c) => c.tags.includes('recepcion'));
        showAlert(
          'Recupera tu PIN',
          rh
            ? `Contacta a Recursos Humanos para restablecer tu PIN: ${rh.name}, ${rh.phone}.`
            : 'Contacta a Recursos Humanos para restablecer tu PIN.'
        );
      })
      .catch(() => showAlert('Recupera tu PIN', 'Contacta a Recursos Humanos para restablecer tu PIN.'));
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { paddingTop: Platform.OS === 'ios' ? 8 : 4 }]}>
        <StepsHeader active={1} onBack={onBack} />

        <View style={styles.head}>
          <BearAvatar size={64} />
          <Text style={[styles.kicker, { marginTop: 16 }]}>Verificación</Text>
          <Text style={styles.title}>{verifiedName ? `Hola, ${verifiedName}` : 'Hola'}</Text>
          <Text style={[styles.sub, { textAlign: 'center' }]}>
            {lockedMessage || (error ? 'PIN incorrecto, intenta de nuevo.' : 'Ingresa tu PIN de 4 dígitos para verificar tu identidad.')}
          </Text>
        </View>

        <View style={{ marginTop: 22 }}>
          <PinDots length={len} total={4} error={error} />
        </View>

        <View style={{ flex: 1, minHeight: 10 }} />

        <OxKeypad onKey={onKey} onDel={onDel} />
        <OxButton variant="ghost" style={{ marginTop: 14 }} onPress={recoverPin}>
          ¿Olvidaste tu PIN? <GhostAccent>Recupéralo</GhostAccent>
        </OxButton>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.cta}>
        <OxButton disabled={len !== 4 || checking || !!lockedMessage} icon={<Icon name="shieldCheck" size={19} color="#fff" />}>
          {checking ? 'Verificando…' : 'Verificar'}
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
    alignItems: 'center',
  },
  kicker: {
    ...type.eyebrow,
    color: colors.oxRed,
  },
  title: {
    ...type.title,
    color: colors.ink,
    marginTop: 4,
  },
  sub: {
    ...type.body,
    color: colors.ink2,
    marginTop: 10,
    maxWidth: 280,
  },
  cta: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});
