// src/screens/RegisterScreen.tsx
// First-login PIN creation for an employee already in the real roster
// (no free-text name entry — the name comes from the roster lookup). Asks
// the birth date first so nobody else can claim the account.
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
import { registerPin } from '../services/auth';
import { obtenerLlave } from '../services/sesion';
import { colors, type } from '../theme/tokens';

const MENSAJES: Record<string, string> = {
  pin_already_set: 'Este número ya tiene un PIN. Usa "Inicia sesión".',
  weak_pin: 'Ese PIN es muy fácil de adivinar (como 1234 o 0000). Elige otro.',
  rh_asigna_pin: 'Por tu puesto, Recursos Humanos te asigna tu primer PIN. Pídeselo a RH.',
  fecha_incorrecta: 'La fecha no coincide con la que tiene RH. Revísala e intenta de nuevo.',
  rate_limited: 'Demasiados intentos. Espera un rato o pide a RH tu primer PIN.',
  not_found: 'No encontramos tu número de empleado.',
};

// 8 typed digits -> "DD/MM/AAAA" while typing, and 'AAAA-MM-DD' when valid.
function mostrarFecha(d: string) {
  const s = d.padEnd(8, '_');
  return `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4, 8)}`;
}
function fechaIso(d: string): string | null {
  if (d.length !== 8) return null;
  const dia = +d.slice(0, 2), mes = +d.slice(2, 4), anio = +d.slice(4, 8);
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  const hoy = new Date().getUTCFullYear();
  if (f.getUTCDate() !== dia || f.getUTCMonth() !== mes - 1 || anio < 1930 || anio > hoy - 14) return null;
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

// First login: the birth date when RH loaded it (checked against it,
// migration 38) and then the new PIN. Both are sent together at the end.
// Without a loaded date it goes straight to the PIN.
export function RegisterScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const { empNum, verifiedName, regPin, setRegPin, pideFecha } = useOnboarding();
  const [paso, setPaso] = useState<'fecha' | 'pin'>(pideFecha ? 'fecha' : 'pin');
  const [fecha, setFecha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const len = regPin.length;
  const iso = fechaIso(fecha);
  const ready = paso === 'fecha' ? !!iso : len === 4;

  const onKey = (k: string) => {
    setError('');
    if (paso === 'fecha') {
      if (fecha.length < 8) setFecha(fecha + k);
    } else if (len < 4) setRegPin(regPin + k);
  };
  const onDel = () => (paso === 'fecha' ? setFecha(fecha.slice(0, -1)) : setRegPin(regPin.slice(0, -1)));

  const back = () => {
    if (paso === 'pin' && pideFecha) {
      setPaso('fecha');
      setRegPin('');
      setError('');
    } else onBack();
  };

  const handleContinue = async () => {
    if (!ready || loading) return;
    if (paso === 'fecha') {
      setPaso('pin');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const st = await registerPin(empNum, iso ?? '', regPin);
      if (st === 'ok') {
        obtenerLlave(empNum, regPin).catch(() => {});
        onContinue();
        return;
      }
      setError(MENSAJES[st] || 'No pudimos crear tu PIN. Intenta de nuevo.');
      setRegPin('');
      if (st === 'fecha_incorrecta') {
        setFecha('');
        setPaso('fecha');
      }
    } catch {
      setError('No pudimos crear tu PIN. Intenta de nuevo.');
      setRegPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { paddingTop: Platform.OS === 'ios' ? 8 : 4 }]}>
        <StepsHeader active={2} onBack={back} />

        <View style={styles.head}>
          <Text style={styles.kicker}>Primer ingreso</Text>
          <Text style={styles.title}>{paso === 'fecha' ? 'Confirma que eres tú' : 'Crea tu PIN'}</Text>
          <Text style={styles.sub}>
            {verifiedName ? `Hola, ${verifiedName}. ` : ''}
            {paso === 'fecha'
              ? 'Para proteger tu cuenta, escribe tu fecha de nacimiento.'
              : 'Crea un PIN de 4 dígitos para entrar a Conoxxo.'}
          </Text>
        </View>

        <View style={styles.fields}>
          <OxField icon="badge" label="Número de empleado" value={empNum} locked tail="Verificado" />
          {paso === 'fecha' ? (
            <View>
              <OxField icon="calendar" label="Fecha de nacimiento" value={mostrarFecha(fecha)} focused tail="DD/MM/AAAA" />
              {fecha.length === 8 && !iso ? <OxHint>Revisa la fecha: día, mes y año completos.</OxHint> : null}
              {error ? <OxHint>{error}</OxHint> : null}
            </View>
          ) : (
            <View>
              <OxLabel>Crea tu PIN de acceso</OxLabel>
              <View style={{ paddingVertical: 6, paddingHorizontal: 2 }}>
                <PinDots length={len} total={4} />
              </View>
              <OxHint>Usarás este PIN cada vez que ingreses a Conoxxo. Evita 1234, 0000 y similares.</OxHint>
              {error ? <OxHint>{error}</OxHint> : null}
            </View>
          )}
        </View>

        <View style={{ flex: 1, minHeight: 8 }} />

        <OxKeypad onKey={onKey} onDel={onDel} />
      </View>

      <SafeAreaView edges={['bottom']} style={styles.cta}>
        <OxButton
          disabled={!ready || loading}
          onPress={handleContinue}
          icon={loading ? <ActivityIndicator color="#fff" /> : <Icon name="arrowR" size={19} color="#fff" />}
        >
          {paso === 'fecha' ? 'Continuar' : 'Crear PIN'}
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
