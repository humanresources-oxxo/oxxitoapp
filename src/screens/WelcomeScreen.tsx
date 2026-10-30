// src/screens/WelcomeScreen.tsx
// Ported from PWelcome in screens-proto.jsx.
import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bear } from '../components/Bear';
import { Icon } from '../components/Icon';
import { OxButton, GhostAccent } from '../components/OxButton';
import { colors, gradients, radii, type } from '../theme/tokens';

const LOGO = require('../../assets/images/conoxxo-logo.png');

const FEATURES: { icon: string; bg: 'oxGrad' | 'blue' | 'green'; title: string; desc: string }[] = [
  {
    icon: 'chat',
    bg: 'oxGrad',
    title: 'Pregunta en lenguaje natural',
    desc: 'Escribe tu duda como se la dirías a un compañero.',
  },
  {
    icon: 'doc',
    bg: 'blue',
    title: 'Respuestas citadas',
    desc: 'Cada respuesta indica el artículo del reglamento.',
  },
  {
    icon: 'headset',
    bg: 'green',
    title: 'Habla con una persona',
    desc: 'Marca directo al área cuando necesites más ayuda.',
  },
];

export function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const { width } = useWindowDimensions();
  const heroTopPad = Platform.OS === 'ios' ? 72 : 18;

  return (
    <View style={styles.screen}>
      {/* Hero */}
      <LinearGradient
        colors={gradients.oxGradHero.colors}
        locations={gradients.oxGradHero.locations}
        start={gradients.oxGradHero.start}
        end={gradients.oxGradHero.end}
        style={[styles.hero, { paddingTop: heroTopPad }]}
      >
        <View style={styles.stage}>
          <View style={[styles.chip, styles.chipA]}>
            <Icon name="clock" size={14} color={colors.oxRed} />
            <Text style={styles.chipText}>¿Cuándo es retardo?</Text>
          </View>
          <Bear size={140} glow="rgba(255,255,255,.32)" />
          <View style={[styles.chip, styles.chipB]}>
            <Icon name="plane" size={14} color={colors.oxRed} />
            <Text style={styles.chipText}>Mis vacaciones</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Body */}
      <View style={styles.body}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Conoxxo" />
          <Text style={styles.eyebrow}>Tu asistente del reglamento</Text>
          <Text style={styles.title}>
            <Text style={styles.brand}>Conoxxo</Text> Plaza Oaxaca
          </Text>

          <View style={styles.feats}>
            {FEATURES.map((f) => (
              <View style={styles.feat} key={f.title}>
                <FeatIcon bg={f.bg} icon={f.icon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.featTitle}>{f.title}</Text>
                  <Text style={styles.featDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <OxButton onPress={onContinue} icon={<Icon name="arrowR" size={19} color="#fff" />}>
            Comenzar
          </OxButton>
          <OxButton variant="ghost" onPress={onContinue}>
            ¿Ya tienes cuenta? <GhostAccent>Inicia sesión</GhostAccent>
          </OxButton>
        </SafeAreaView>
      </View>
    </View>
  );
}

function FeatIcon({ bg, icon }: { bg: 'oxGrad' | 'blue' | 'green'; icon: string }) {
  const g = gradients[bg];
  return (
    <LinearGradient colors={g.colors} start={g.start} end={g.end} style={styles.featIcon}>
      <Icon name={icon} size={19} color="#fff" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: radii.hero,
    borderBottomRightRadius: radii.hero,
    overflow: 'hidden',
    shadowColor: colors.oxRed,
    shadowOpacity: 0.5,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  stage: {
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.8)',
    maxWidth: 168,
    shadowColor: 'rgba(120,30,8,1)',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  chipA: { top: 14, left: 4, transform: [{ rotate: '-5deg' }] },
  chipB: { bottom: 8, right: 4, transform: [{ rotate: '5deg' }] },
  chipText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: colors.ink,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 8,
  },
  logo: {
    width: 176,
    height: 72, // conoxxo-logo.png is 1000x408
    marginLeft: -6,
    marginBottom: 14,
  },
  eyebrow: {
    ...type.eyebrowSm,
    color: colors.oxRed,
    marginBottom: 9,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: colors.ink,
    maxWidth: 260,
  },
  brand: {
    color: colors.oxRed,
  },
  feats: {
    marginTop: 20,
    gap: 10,
  },
  feat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.8)',
  },
  featIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14.5,
    letterSpacing: -0.1,
    color: colors.ink,
  },
  featDesc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: colors.ink2,
    marginTop: 3,
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: 26,
    paddingTop: 10,
  },
});
