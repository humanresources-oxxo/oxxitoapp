// src/screens/PermissionsScreen.tsx
// Ported from PPermissions in screens-proto.jsx.
import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StepsHeader } from '../components/StepsHeader';
import { OxButton } from '../components/OxButton';
import { Icon } from '../components/Icon';
import { useOnboarding } from '../context/OnboardingContext';
import { setJson, storageKeys } from '../services/appStorage';
import { colors, gradients, radii, type } from '../theme/tokens';

export function PermissionsScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const { empNum, verifiedName, tienda, plaza, puesto, createdAt, notif, setNotif, terms, setTerms } =
    useOnboarding();

  const finish = () => {
    if (!terms) return;
    setJson(storageKeys.session, { numeroEmpleado: empNum, nombre: verifiedName, tienda, plaza, puesto, createdAt });
    onContinue();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { paddingTop: Platform.OS === 'ios' ? 8 : 4 }]}>
        <StepsHeader active={3} onBack={onBack} />

        <View style={styles.head}>
          <Text style={styles.kicker}>Casi listo</Text>
          <Text style={styles.title}>Permisos y términos</Text>
          <Text style={styles.sub}>Un último paso para personalizar tu experiencia con Conoxxo.</Text>
        </View>

        <View style={styles.fields}>
          <View style={styles.card}>
            <View style={styles.perm}>
              <LinearGradient colors={gradients.oxGrad.colors} style={styles.permIcon}>
                <Icon name="bell" size={22} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.permTitle}>Notificaciones</Text>
                <Text style={styles.permDesc}>Avisos sobre cambios en el reglamento y políticas.</Text>
              </View>
              <Toggle on={notif} onPress={() => setNotif(!notif)} />
            </View>
            <View style={styles.permDivider} />
            <View style={styles.perm}>
              <LinearGradient colors={gradients.dark.colors} style={styles.permIcon}>
                <Icon name="shield" size={22} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.permTitle}>Privacidad de datos</Text>
                <Text style={styles.permDesc}>Tus consultas son confidenciales y de uso interno.</Text>
              </View>
              <Icon name="check" size={20} color={colors.ok} />
            </View>
          </View>

          <Pressable style={styles.check} onPress={() => setTerms(!terms)}>
            <View style={[styles.box, !terms && styles.boxEmpty]}>
              {terms ? <Icon name="check" size={15} color="#fff" strokeWidth={2.4} /> : null}
            </View>
            <Text style={styles.checkText}>
              Acepto los <Text style={styles.checkLink}>Términos de uso</Text> y el{' '}
              <Text style={styles.checkLink}>Aviso de Privacidad</Text> de Cadena Comercial OXXO.
            </Text>
          </Pressable>
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.cta}>
        <OxButton
          disabled={!terms}
          onPress={finish}
          icon={<Icon name="arrowR" size={19} color="#fff" />}
        >
          Aceptar y entrar
        </OxButton>
      </SafeAreaView>
    </View>
  );
}

function Toggle({ on, onPress }: { on: boolean; onPress: () => void }) {
  const anim = useRef(new Animated.Value(on ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.timing(anim, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [on, anim]);

  const knobLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 21] });

  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={on ? gradients.oxGrad.colors : [colors.line2, colors.line2]}
        style={styles.toggle}
      >
        <Animated.View style={[styles.toggleKnob, { left: knobLeft }]} />
      </LinearGradient>
    </Pressable>
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
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.xl,
  },
  perm: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    padding: 16,
  },
  permDivider: {
    height: 1,
    backgroundColor: colors.line,
    marginHorizontal: 16,
  },
  permIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: colors.ink,
  },
  permDesc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: colors.ink2,
    marginTop: 4,
    lineHeight: 18,
  },
  toggle: {
    width: 46,
    height: 28,
    borderRadius: radii.pill,
    marginTop: 2,
  },
  toggleKnob: {
    position: 'absolute',
    top: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  check: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    marginTop: 1,
    backgroundColor: colors.oxRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxEmpty: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.line2,
  },
  checkText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: colors.ink2,
    lineHeight: 19,
  },
  checkLink: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.oxRed,
  },
  cta: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
});
