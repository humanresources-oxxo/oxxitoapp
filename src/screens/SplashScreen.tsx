// src/screens/SplashScreen.tsx
// App-open animation. The bear drops in on a soft halo and keeps floating
// while he waves (the GIF), his "¡Hola!" pops out next to his head, a few
// stars twinkle around him, and the logo comes up with a thin bar that fills
// while the app gets ready. With "reduce motion" on, everything is shown in
// place, without movement.
import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing, AccessibilityInfo } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../components/Icon';
import { gradients, colors, fontFamily, radii } from '../theme/tokens';

const BEAR_GIF = require('../../assets/images/osito_saludando.gif');
const LOGO = require('../../assets/images/conoxxo-logo.png');

// Same total time as before, so opening the app is not slower.
const SALIDA = 2300;
const FIN = 2820;
const ANCHO_BARRA = 132;

// Stars around the bear: where, how big and when each one starts.
const ESTRELLAS = [
  { top: 34, left: 2, size: 26, color: colors.oxGold, delay: 650 },
  { top: 132, right: -6, size: 19, color: colors.oxRed, delay: 900 },
  { bottom: 62, left: -4, size: 18, color: colors.oxGold, delay: 1150 },
  { bottom: 110, right: 6, size: 23, color: colors.oxGold, delay: 1350 },
];

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const v = useRef({
    entra: new Animated.Value(0), // bear: 0 below and small -> 1 in place
    halo: new Animated.Value(0),
    flota: new Animated.Value(0), // idle float, 0 <-> 1
    burbuja: new Animated.Value(0),
    logo: new Animated.Value(0),
    lema: new Animated.Value(0),
    barra: new Animated.Value(0),
    sale: new Animated.Value(0),
    estrellas: ESTRELLAS.map(() => new Animated.Value(0)),
  }).current;

  useEffect(() => {
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const bucles: Animated.CompositeAnimation[] = [];
    const luego = (ms: number, fn: () => void) => timers.push(setTimeout(() => vivo && fn(), ms));
    const nativo = { useNativeDriver: true };

    const animar = () => {
      // Bear: springs up into place over its halo.
      Animated.spring(v.entra, { toValue: 1, damping: 9, stiffness: 110, mass: 0.8, ...nativo }).start();
      Animated.timing(v.halo, { toValue: 1, duration: 520, easing: Easing.out(Easing.back(1.4)), ...nativo }).start();

      // Then he floats gently for as long as the splash is up.
      luego(650, () => {
        const flotar = Animated.loop(
          Animated.sequence([
            Animated.timing(v.flota, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.sin), ...nativo }),
            Animated.timing(v.flota, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.sin), ...nativo }),
          ])
        );
        bucles.push(flotar);
        flotar.start();
      });

      // "¡Hola!" pops out of his head with a little swing.
      luego(800, () => Animated.spring(v.burbuja, { toValue: 1, damping: 7, stiffness: 150, mass: 0.7, ...nativo }).start());

      // Stars twinkle, one after another.
      ESTRELLAS.forEach((e, i) =>
        luego(e.delay, () => {
          const brillar = Animated.loop(
            Animated.sequence([
              Animated.timing(v.estrellas[i], { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), ...nativo }),
              Animated.timing(v.estrellas[i], { toValue: 0, duration: 520, easing: Easing.in(Easing.quad), ...nativo }),
              Animated.delay(260),
            ])
          );
          bucles.push(brillar);
          brillar.start();
        })
      );

      // Logo, then its line, then the bar that fills until the app opens.
      luego(450, () => Animated.timing(v.logo, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), ...nativo }).start());
      luego(800, () => Animated.timing(v.lema, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), ...nativo }).start());
      luego(500, () => Animated.timing(v.barra, { toValue: 1, duration: SALIDA - 600, easing: Easing.inOut(Easing.cubic), ...nativo }).start());

      luego(SALIDA, () => Animated.timing(v.sale, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), ...nativo }).start());
      luego(FIN, onDone);
    };

    const quieto = () => {
      [v.entra, v.halo, v.burbuja, v.logo, v.lema, v.barra].forEach((x) => x.setValue(1));
      luego(1500, onDone);
    };

    const consulta = AccessibilityInfo.isReduceMotionEnabled?.();
    if (consulta) consulta.then((reducir) => vivo && (reducir ? quieto() : animar())).catch(() => vivo && animar());
    else animar();

    return () => {
      vivo = false;
      timers.forEach(clearTimeout);
      bucles.forEach((b) => b.stop());
    };
  }, []);

  const rango = (x: Animated.Value, de: number, a: number) => x.interpolate({ inputRange: [0, 1], outputRange: [de, a] });

  return (
    <Animated.View style={[styles.fill, { opacity: rango(v.sale, 1, 0) }]}>
      <LinearGradient
        colors={gradients.splash.colors}
        locations={gradients.splash.locations}
        start={gradients.splash.start}
        end={gradients.splash.end}
        style={styles.fill}
      >
        <View style={[styles.orb, styles.orbArriba]} />
        <View style={[styles.orb, styles.orbAbajo]} />

        <Animated.View style={[styles.stage, { transform: [{ translateY: rango(v.sale, 0, -18) }] }]}>
          <View style={styles.mascota}>
            <Animated.View style={[styles.halo, { opacity: v.halo, transform: [{ scale: Animated.add(rango(v.halo, 0.6, 1), rango(v.flota, 0, 0.05)) }] }]}>
              <View style={styles.haloDentro} />
            </Animated.View>

            {/* His shadow on the floor shrinks a little when he floats up. */}
            <Animated.View style={[styles.sombra, { opacity: rango(v.entra, 0, 1), transform: [{ scaleX: rango(v.flota, 1, 0.86) }] }]} />

            {ESTRELLAS.map(({ size, color, delay, ...pos }, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.estrella,
                  pos,
                  {
                    opacity: v.estrellas[i],
                    transform: [{ scale: rango(v.estrellas[i], 0.3, 1) }, { rotate: v.estrellas[i].interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '20deg'] }) }],
                  },
                ]}
              >
                <Icon name="sparkle" size={size} color={color} fill />
              </Animated.View>
            ))}

            <Animated.View
              style={{
                opacity: v.entra.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
                transform: [{ translateY: Animated.add(rango(v.entra, 70, 0), rango(v.flota, 0, -7)) }, { scale: rango(v.entra, 0.4, 1) }],
              }}
            >
              <Image source={BEAR_GIF} style={styles.bearImg} resizeMode="contain" accessibilityLabel="Osito saludando" />
            </Animated.View>

            <Animated.View
              style={[
                styles.bubble,
                {
                  opacity: v.burbuja.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
                  transform: [
                    { translateY: Animated.add(rango(v.burbuja, 16, 0), rango(v.flota, 0, -4)) },
                    { scale: rango(v.burbuja, 0.3, 1) },
                    { rotate: v.burbuja.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '4deg'] }) },
                  ],
                },
              ]}
            >
              <Text style={styles.bubbleText} numberOfLines={1}>
                ¡Hola! 👋
              </Text>
              <View style={styles.bubbleCola} />
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.wordWrap, { opacity: v.logo, transform: [{ translateY: rango(v.logo, 20, 0) }, { scale: rango(v.logo, 0.92, 1) }] }]}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Conoxxo" />
          <Animated.Text style={[styles.tagline, { opacity: v.lema }]}>Tu asistente del reglamento</Animated.Text>
          <Animated.View style={[styles.barra, { opacity: v.lema }]} accessibilityRole="progressbar" accessibilityLabel="Abriendo Conoxxo">
            <Animated.View style={[styles.barraLlena, { transform: [{ translateX: rango(v.barra, -ANCHO_BARRA, 0) }] }]} />
          </Animated.View>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.oxGold,
    opacity: 0.14,
  },
  orbArriba: { width: 240, height: 240, top: -80, left: -80 },
  orbAbajo: { width: 280, height: 280, bottom: -110, right: -100 },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 150, // room for the logo block below
  },
  mascota: {
    width: 240,
    height: 300,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  halo: {
    position: 'absolute',
    top: 34,
    width: 236,
    height: 236,
    borderRadius: 118,
    backgroundColor: 'rgba(246,184,0,.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloDentro: { width: 176, height: 176, borderRadius: 88, backgroundColor: 'rgba(255,255,255,.7)' },
  sombra: {
    position: 'absolute',
    bottom: -4,
    width: 116,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(36,26,23,.09)',
  },
  estrella: { position: 'absolute' },
  bearImg: {
    width: 196,
    height: 274, // osito_saludando.gif is 561x785
  },
  // Next to his right ear, with the tail pointing at him.
  bubble: {
    position: 'absolute',
    top: -20,
    left: 146,
    width: 108,
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 18,
    shadowColor: 'rgba(120,30,8,1)',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  bubbleCola: {
    position: 'absolute',
    left: 16,
    bottom: -5,
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: colors.white,
    transform: [{ rotate: '45deg' }],
  },
  bubbleText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 16,
    color: colors.ink,
  },
  wordWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '9%',
    alignItems: 'center',
  },
  logo: {
    width: 230,
    height: 94, // conoxxo-logo.png is 1000x408
  },
  tagline: {
    fontFamily: fontFamily.bold,
    fontSize: 13.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.ink2,
    marginTop: 10,
  },
  barra: {
    width: ANCHO_BARRA,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(36,26,23,.1)',
    overflow: 'hidden',
    marginTop: 16,
  },
  barraLlena: {
    width: ANCHO_BARRA,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.oxRed,
  },
});
