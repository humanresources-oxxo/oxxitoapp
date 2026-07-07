// src/components/Bear.tsx
// Mascot components — ported from oxxito-ui.jsx (Bear, BearAvatar).
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';

const BEAR_IMG = require('../../assets/images/oxxito-bear.png');
// Native size of the source asset, used to keep the mascot from distorting.
const BEAR_W = 543;
const BEAR_H = 746;
const BEAR_ASPECT = BEAR_W / BEAR_H;
// Vertical crop window (in source pixels) that frames the face for the round avatar.
const FACE_TOP = 90;
const FACE_BOTTOM = 490;

type BearProps = {
  size?: number;
  glow?: string;
};

/** Large mascot with a soft glow behind it — used on Welcome hero. */
export function Bear({ size = 180, glow = 'rgba(255,255,255,.55)' }: BearProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={[
          styles.glow,
          {
            width: size * 0.92,
            height: size * 0.92,
            backgroundColor: glow,
            borderRadius: (size * 0.92) / 2,
          },
        ]}
      />
      <Image
        source={BEAR_IMG}
        style={{
          width: size,
          height: size / BEAR_ASPECT,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

type BearAvatarProps = {
  size?: number;
  bg?: string;
};

/** Circular head-crop avatar — used in chat bubbles, top headers, verify screen. */
export function BearAvatar({ size = 38, bg = colors.cream }: BearAvatarProps) {
  const scale = size / (FACE_BOTTOM - FACE_TOP);
  const imgWidth = BEAR_W * scale;
  const imgHeight = BEAR_H * scale;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    >
      <Image
        source={BEAR_IMG}
        style={{
          position: 'absolute',
          width: imgWidth,
          height: imgHeight,
          top: -FACE_TOP * scale,
          left: (size - imgWidth) / 2,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    opacity: 0.9,
  },
  avatar: {
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.7)',
  },
});
