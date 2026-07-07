// src/screens/SplashScreen.tsx
// Ported from launch.jsx — branded app-open animation.
// Note: animated GIF playback + entrance/exit choreography (bounce-in, bubble pop, sparkles, exit fade).
import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing, AccessibilityInfo } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, colors } from '../theme/tokens';

const BEAR_GIF = require('../../assets/images/osito_saludando.gif');

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const bearScale = useRef(new Animated.Value(0.35)).current;
  const bearY = useRef(new Animated.Value(40)).current;
  const bubbleScale = useRef(new Animated.Value(0.5)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordY = useRef(new Animated.Value(14)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;
  const sparkAnims = useRef([0, 1, 2].map(() => ({
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0),
    y: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    let reduced = false;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => {
      reduced = v;
      if (v) {
        bearScale.setValue(1);
        bearY.setValue(0);
        bubbleScale.setValue(1);
        bubbleOpacity.setValue(1);
        wordOpacity.setValue(1);
        wordY.setValue(0);
      }
    });

    // Bear bounce-in: scale .35->1, translateY 40->0, overshoot bezier ~.62s
    Animated.parallel([
      Animated.spring(bearScale, {
        toValue: 1,
        damping: 9,
        stiffness: 120,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.spring(bearY, {
        toValue: 0,
        damping: 10,
        stiffness: 120,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start();

    // Speech bubble pop at 1s
    const bubbleTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(bubbleOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(bubbleScale, { toValue: 1, damping: 7, stiffness: 160, useNativeDriver: true }),
      ]).start();
    }, 1000);

    // Wordmark fade-up at .9s
    const wordTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(wordOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(wordY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }, 900);

    // Sparkles staggered .7/.95/1.15s
    const sparkDelays = [700, 950, 1150];
    const sparkTimers = sparkAnims.map((s, i) =>
      setTimeout(() => {
        Animated.sequence([
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 1, duration: 270, useNativeDriver: true }),
            Animated.timing(s.scale, { toValue: 1.2, duration: 270, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(s.opacity, { toValue: 0, duration: 360, useNativeDriver: true }),
            Animated.timing(s.scale, { toValue: 0.4, duration: 360, useNativeDriver: true }),
            Animated.timing(s.y, { toValue: -10, duration: 360, useNativeDriver: true }),
          ]),
        ]).start();
      }, sparkDelays[i])
    );

    // Exit at 2300ms, unmount at 2820ms
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(screenOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(screenScale, { toValue: 1.08, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 2300);

    const doneTimer = setTimeout(onDone, 2820);

    return () => {
      clearTimeout(bubbleTimer);
      clearTimeout(wordTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
      sparkTimers.forEach(clearTimeout);
    };
  }, []);

  return (
    <Animated.View style={[styles.fill, { opacity: screenOpacity, transform: [{ scale: screenScale }] }]}>
      <LinearGradient
        colors={gradients.splash.colors}
        locations={gradients.splash.locations}
        start={gradients.splash.start}
        end={gradients.splash.end}
        style={styles.fill}
      >
        {/* sheen + orbs (approximation of blurred radial orbs) */}
        <View style={[styles.orb, styles.orbGold]} />
        <View style={[styles.orb, styles.orbRed]} />
        <View style={styles.sheen} />

        <View style={styles.stage}>
          <Animated.View
            style={[
              styles.bubble,
              { opacity: bubbleOpacity, transform: [{ scale: bubbleScale }] },
            ]}
          >
            <Text style={styles.bubbleText}>¡Hola! 👋</Text>
          </Animated.View>

          <Animated.View
            style={{
              transform: [{ scale: bearScale }, { translateY: bearY }],
            }}
          >
            <Image source={BEAR_GIF} style={styles.bearImg} resizeMode="contain" />
          </Animated.View>

          {sparkAnims.map((s, i) => (
            <Animated.View
              key={i}
              style={[
                styles.spark,
                SPARK_POS[i],
                {
                  opacity: s.opacity,
                  transform: [{ scale: s.scale }, { translateY: s.y }],
                },
              ]}
            />
          ))}
        </View>

        <Animated.View style={[styles.wordWrap, { opacity: wordOpacity, transform: [{ translateY: wordY }] }]}>
          <Text style={styles.wordmark}>Oxxito</Text>
          <Text style={styles.tagline}>TU ASISTENTE DEL REGLAMENTO</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const SPARK_POS = [
  { top: 18, left: '38%' as const },
  { bottom: 160, left: '28%' as const },
  { top: 60, right: '32%' as const },
];

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.45,
  },
  orbGold: {
    width: 220,
    height: 220,
    top: -60,
    left: -60,
    backgroundColor: colors.oxGold,
  },
  orbRed: {
    width: 240,
    height: 240,
    bottom: -70,
    right: -70,
    backgroundColor: '#FF3B24',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '70%',
    height: '40%',
    backgroundColor: 'rgba(255,255,255,.18)',
    borderBottomLeftRadius: 400,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    position: 'absolute',
    top: '32%',
    backgroundColor: '#fff',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    shadowColor: 'rgba(120,30,8,1)',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  bubbleText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 15,
    color: colors.ink,
  },
  bearImg: {
    width: 196,
    height: 270,
  },
  spark: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  wordWrap: {
    position: 'absolute',
    bottom: '14%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 44,
    color: '#fff',
    letterSpacing: -0.4,
  },
  tagline: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.95)',
    marginTop: 8,
  },
});
