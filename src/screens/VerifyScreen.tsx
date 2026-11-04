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
import { changePin, verifyPin } from '../services/auth';
import { obtenerLlave } from '../services/sesion';
import { fetchContacts } from '../services/directory';
import { showAlert } from '../utils/alert';
import { colors, type } from '../theme/tokens';

// The lockout grows with each failure (migration 37): 15 min, 1 h, 24 h.
function tiempoRestante(lockedUntil: string) {
  const min = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000));
  return min < 90 ? `${min} min` : `${Math.round(min / 60)} h`;
}
const lockText = (lockedUntil: string) =>
  `Cuenta bloqueada por varios intentos fallidos. Intenta de nuevo en ${tiempoRestante(lockedUntil)} o pide a RH que reinicie tu PIN.`;

export function VerifyScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const { empNum, pin, setPin, verifiedName } = useOnboarding();
  const len = pin.length;
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lockedMessage, setLockedMessage] = useState('');
  // Temporary PIN from RH that was just accepted: the employee now picks
  // their own (it replaces the temporary one through change_pin).
  const [temporal, setTemporal] = useState('');
  const [nuevoError, setNuevoError] = useState('');

  const onKey = (k: string) => {
    if (len >= 4 || checking || lockedMessage) return;
    const next = pin + k;
    setPin(next);
    setError(false);
    setNuevoError('');
    if (next.length === 4 && temporal) {
      setChecking(true);
      changePin(empNum, temporal, next)
        .then((st) => {
          if (st === 'ok') {
            obtenerLlave(empNum, next).catch(() => {});
            onContinue();
            return;
          }
          setNuevoError(
            st === 'weak_pin'
              ? 'Ese PIN es muy fácil de adivinar (como 1234 o 0000). Elige otro.'
              : 'No pudimos guardar tu PIN nuevo. Intenta de nuevo.'
          );
          setTimeout(() => setPin(''), 420);
        })
        .catch(() => {
          setNuevoError('No pudimos conectar. Intenta de nuevo.');
          setTimeout(() => setPin(''), 420);
        })
        .finally(() => setChecking(false));
      return;
    }
    if (next.length === 4) {
      setChecking(true);
      verifyPin(empNum, next)
        .then((result) => {
          if (result.status === 'ok') {
            if (result.pinIsTemporary) {
              setTemporal(next);
              setTimeout(() => setPin(''), 200);
              return;
            }
            // Session key for avisos and votaciones (migration 35). If it
            // fails, those screens ask for the PIN once later.
            obtenerLlave(empNum, next).catch(() => {});
            onContinue();
            return;
          }
          if (result.status === 'pendiente') {
            setLockedMessage('Tu cuenta está esperando que tu asesor o RH la apruebe. Cuando la aprueben, entra con tu número y tu PIN.');
          } else if (result.status === 'locked') {
            setLockedMessage(lockText(result.lockedUntil));
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
          <Text style={[styles.kicker, { marginTop: 16 }]}>{temporal ? 'PIN nuevo' : 'Verificación'}</Text>
          <Text style={styles.title}>{temporal ? 'Crea tu PIN' : verifiedName ? `Hola, ${verifiedName}` : 'Hola'}</Text>
          <Text style={[styles.sub, { textAlign: 'center' }]}>
            {temporal
              ? nuevoError || 'RH te dio un PIN temporal. Elige uno nuevo de 4 dígitos que solo tú sepas.'
              : lockedMessage || (error ? 'PIN incorrecto, intenta de nuevo.' : 'Ingresa tu PIN de 4 dígitos para verificar tu identidad.')}
          </Text>
        </View>

        <View style={{ marginTop: 22 }}>
          <PinDots length={len} total={4} error={error || !!nuevoError} />
        </View>

        <View style={{ flex: 1, minHeight: 10 }} />

        <OxKeypad onKey={onKey} onDel={onDel} />
        {!temporal ? (
          <OxButton variant="ghost" style={{ marginTop: 14 }} onPress={recoverPin}>
            ¿Olvidaste tu PIN? <GhostAccent>Recupéralo</GhostAccent>
          </OxButton>
        ) : null}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.cta}>
        <OxButton disabled={len !== 4 || checking || !!lockedMessage} icon={<Icon name="shieldCheck" size={19} color="#fff" />}>
          {checking ? (temporal ? 'Guardando…' : 'Verificando…') : temporal ? 'Guardar PIN' : 'Verificar'}
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
