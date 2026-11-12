// src/components/Vidrio.tsx
// Frosted glass for what floats over the content (tab bar, headers, the chat
// box): translucent white with a bright rim. It really blurs on iOS and on
// the web; on Android expo-blur shows the same translucent white without the
// blur (cheap on store phones). With "reduce transparency" on, it is solid.
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, vidrio } from '../theme/tokens';

let reducir: boolean | null = null;
function useReducirTransparencia() {
  const [valor, setValor] = useState(reducir ?? false);
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => {
        reducir = !!v;
        if (vivo) setValor(!!v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', (v) => {
      reducir = !!v;
      setValor(!!v);
    });
    return () => {
      vivo = false;
      sub?.remove?.();
    };
  }, []);
  return valor;
}

export function Vidrio({ style, intensidad = 42, children, ...rest }: ViewProps & { style?: StyleProp<ViewStyle>; intensidad?: number }) {
  const solido = useReducirTransparencia();
  if (solido) {
    return (
      <View {...rest} style={[vidrio, { overflow: 'hidden' }, style, { backgroundColor: colors.card }]}>
        {children}
      </View>
    );
  }
  return (
    <BlurView {...rest} intensity={intensidad} tint="light" style={[vidrio, { overflow: 'hidden' }, style]}>
      {children}
    </BlurView>
  );
}
