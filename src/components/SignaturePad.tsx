// src/components/SignaturePad.tsx
// Finger signature box. Strokes are kept in a fixed 900x300 space (same 3:1
// ratio as the slot in the Word) so they can be turned into a PNG later.
import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, radii } from '../theme/tokens';
import { FIRMA_ALTO, FIRMA_ANCHO, FIRMA_GROSOR, Trazo } from '../utils/firmaPng';

const TINTA = '#14213D';

export function trazosAPath(trazo: Trazo) {
  return trazo.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

export function SignatureStrokes({ trazos, extra }: { trazos: Trazo[]; extra?: Trazo | null }) {
  const todos = extra ? [...trazos, extra] : trazos;
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${FIRMA_ANCHO} ${FIRMA_ALTO}`}>
      {todos.map((t, i) =>
        t.length === 1 ? (
          <Circle key={i} cx={t[0].x} cy={t[0].y} r={FIRMA_GROSOR / 2} fill={TINTA} />
        ) : (
          <Path
            key={i}
            d={trazosAPath(t)}
            stroke={TINTA}
            strokeWidth={FIRMA_GROSOR}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )
      )}
    </Svg>
  );
}

type Props = {
  trazos: Trazo[];
  disabled?: boolean;
  // Called when a stroke ends, with all strokes so far.
  onChange: (trazos: Trazo[]) => void;
};

export function SignaturePad({ trazos, disabled, onChange }: Props) {
  const [ancho, setAncho] = useState(0);
  const [actual, setActual] = useState<Trazo | null>(null);
  const actualRef = useRef<Trazo | null>(null);
  // PanResponder is created once; read the latest props through a ref.
  const props = useRef({ trazos, disabled, onChange, ancho });
  props.current = { trazos, disabled, onChange, ancho };

  const responder = useMemo(() => {
    const punto = (e: { nativeEvent: { locationX: number; locationY: number } }) => {
      const escala = FIRMA_ANCHO / (props.current.ancho || FIRMA_ANCHO);
      return {
        x: Math.max(0, Math.min(FIRMA_ANCHO, e.nativeEvent.locationX * escala)),
        y: Math.max(0, Math.min(FIRMA_ALTO, e.nativeEvent.locationY * escala)),
      };
    };
    const soltar = () => {
      const t = actualRef.current;
      actualRef.current = null;
      setActual(null);
      if (t && t.length) props.current.onChange([...props.current.trazos, t]);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !props.current.disabled,
      onMoveShouldSetPanResponder: () => !props.current.disabled,
      // While drawing, the form's ScrollView must not steal the gesture.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        actualRef.current = [punto(e)];
        setActual(actualRef.current);
      },
      onPanResponderMove: (e) => {
        if (!actualRef.current) return;
        actualRef.current = [...actualRef.current, punto(e)];
        setActual(actualRef.current);
      },
      onPanResponderRelease: soltar,
      onPanResponderTerminate: soltar,
    });
  }, []);

  return (
    <View
      style={[styles.pad, disabled && styles.padDisabled, Platform.OS === 'web' && ({ touchAction: 'none', cursor: 'crosshair' } as object)]}
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      <View style={styles.baseLine} pointerEvents="none" />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SignatureStrokes trazos={trazos} extra={actual} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    width: '100%',
    aspectRatio: FIRMA_ANCHO / FIRMA_ALTO,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.line2,
    borderStyle: 'dashed',
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  padDisabled: {
    backgroundColor: colors.field,
  },
  baseLine: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    bottom: '22%',
    height: 1,
    backgroundColor: colors.line2,
  },
});
