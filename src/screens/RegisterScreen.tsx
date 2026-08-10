// src/screens/RegisterScreen.tsx
// First-login flow for an employee already in the real roster: verify an
// email (friction against casual account-grabbing, not real identity proof
// since employees have no company email on file), then create a PIN.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StepsHeader } from '../components/StepsHeader';
import { OxField, OxLabel, OxHint } from '../components/OxField';
import { PinDots } from '../components/PinDots';
import { OxKeypad } from '../components/OxKeypad';
import { OxButton } from '../components/OxButton';
import { Icon } from '../components/Icon';
import { useOnboarding } from '../context/OnboardingContext';
import { setInitialPin, requestEmailCode, verifyEmailCode } from '../services/auth';
import { colors, type } from '../theme/tokens';

type Step = 'email' | 'code' | 'pin';

export function RegisterScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const { empNum, verifiedName, regPin, setRegPin } = useOnboarding();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const codeReady = code.length === 6;
  const pinLen = regPin.length;
  const pinReady = pinLen === 4;

  const sendCode = async () => {
    if (!emailReady || loading) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const status = await requestEmailCode(empNum, email.trim());
      if (status === 'sent') {
        if (step === 'code') {
          setCode('');
          setNotice('Te mandamos un código nuevo.');
        } else {
          setStep('code');
        }
      } else if (status === 'already_has_pin') {
        setError('Este número ya tiene un PIN. Usa "Inicia sesión".');
      } else if (status === 'rate_limited') {
        setError('Demasiados intentos. Espera unos minutos e intenta de nuevo.');
      } else {
        setError('No pudimos enviar el código. Intenta de nuevo.');
      }
    } catch {
      setError('No pudimos conectar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const onCodeKey = (k: string) => {
    if (code.length < 6) setCode(code + k);
  };
  const onCodeDel = () => setCode(code.slice(0, -1));

  const submitCode = async () => {
    if (!codeReady || loading) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const status = await verifyEmailCode(empNum, email.trim(), code);
      if (status === 'ok') {
        setStep('pin');
      } else if (status === 'expired') {
        setError('El código venció. Pide uno nuevo.');
        setCode('');
      } else if (status === 'too_many_attempts') {
        setError('Demasiados intentos. Pide un código nuevo.');
        setCode('');
      } else {
        setError('Código incorrecto.');
        setCode('');
      }
    } catch {
      setError('No pudimos conectar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const onPinKey = (k: string) => {
    if (pinLen < 4) setRegPin(regPin + k);
  };
  const onPinDel = () => setRegPin(regPin.slice(0, -1));

  const createPin = async () => {
    if (!pinReady || loading) return;
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
          : message.includes('email_not_verified')
          ? 'Verifica tu correo de nuevo antes de crear tu PIN.'
          : 'No pudimos crear tu PIN. Intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  const back = () => {
    setError('');
    setNotice('');
    if (step === 'code') {
      setStep('email');
    } else if (step === 'pin') {
      setStep('code');
    } else {
      onBack();
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { paddingTop: Platform.OS === 'ios' ? 8 : 4 }]}>
        <StepsHeader active={2} onBack={back} />

        {step === 'email' ? (
          <>
            <View style={styles.head}>
              <Text style={styles.kicker}>Primer ingreso</Text>
              <Text style={styles.title}>Verifica tu correo</Text>
              <Text style={styles.sub}>
                {verifiedName ? `Hola, ${verifiedName}. ` : ''}Escribe tu correo para mandarte un código de
                verificación antes de crear tu PIN.
              </Text>
            </View>

            <View style={styles.fields}>
              <OxField icon="user" label="Nombre" value={verifiedName} locked />
              <OxField icon="badge" label="Número de empleado" value={empNum} locked tail="Verificado" />
              <OxField
                icon="message"
                label="Correo"
                value={email}
                onChangeText={setEmail}
                placeholder="tucorreo@ejemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {error ? <OxHint>{error}</OxHint> : null}
            </View>
          </>
        ) : step === 'code' ? (
          <>
            <View style={styles.head}>
              <Text style={styles.kicker}>Primer ingreso</Text>
              <Text style={styles.title}>Ingresa el código</Text>
              <Text style={styles.sub}>Te mandamos un código de 6 dígitos a {email.trim()}.</Text>
            </View>

            <View style={styles.fields}>
              <View>
                <OxLabel>Código de verificación</OxLabel>
                <View style={{ paddingVertical: 6, paddingHorizontal: 2 }}>
                  <PinDots length={code.length} total={6} />
                </View>
                {error ? <OxHint>{error}</OxHint> : null}
                {notice ? <OxHint>{notice}</OxHint> : null}
              </View>
              <Pressable onPress={sendCode} disabled={loading} style={loading && { opacity: 0.5 }}>
                <OxHint>¿No te llegó? Reenviar código</OxHint>
              </Pressable>
            </View>

            <View style={{ flex: 1, minHeight: 8 }} />

            <OxKeypad onKey={onCodeKey} onDel={onCodeDel} />
          </>
        ) : (
          <>
            <View style={styles.head}>
              <Text style={styles.kicker}>Primer ingreso</Text>
              <Text style={styles.title}>Crea tu PIN</Text>
              <Text style={styles.sub}>Correo verificado. Ahora crea un PIN de 4 dígitos para proteger tu cuenta.</Text>
            </View>

            <View style={styles.fields}>
              <OxField icon="user" label="Nombre" value={verifiedName} locked />
              <OxField icon="badge" label="Número de empleado" value={empNum} locked tail="Verificado" />
              <View>
                <OxLabel>Crea tu PIN de acceso</OxLabel>
                <View style={{ paddingVertical: 6, paddingHorizontal: 2 }}>
                  <PinDots length={pinLen} total={4} />
                </View>
                <OxHint>Usarás este PIN cada vez que ingreses a Oxxito.</OxHint>
                {error ? <OxHint>{error}</OxHint> : null}
              </View>
            </View>

            <View style={{ flex: 1, minHeight: 8 }} />

            <OxKeypad onKey={onPinKey} onDel={onPinDel} />
          </>
        )}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.cta}>
        {step === 'email' ? (
          <OxButton
            disabled={!emailReady || loading}
            onPress={sendCode}
            icon={loading ? <ActivityIndicator color="#fff" /> : <Icon name="arrowR" size={19} color="#fff" />}
          >
            Enviar código
          </OxButton>
        ) : step === 'code' ? (
          <OxButton
            disabled={!codeReady || loading}
            onPress={submitCode}
            icon={loading ? <ActivityIndicator color="#fff" /> : <Icon name="arrowR" size={19} color="#fff" />}
          >
            Verificar código
          </OxButton>
        ) : (
          <OxButton
            disabled={!pinReady || loading}
            onPress={createPin}
            icon={loading ? <ActivityIndicator color="#fff" /> : <Icon name="arrowR" size={19} color="#fff" />}
          >
            Crear PIN
          </OxButton>
        )}
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
