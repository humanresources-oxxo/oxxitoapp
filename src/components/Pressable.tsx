// src/components/Pressable.tsx
// React Native's Pressable with a visible answer to the touch: every button,
// card and row of the app dims while pressed. sinEfecto turns it off (e.g. a
// backdrop that only closes a sheet).
import React from 'react';
import { Pressable as RNPressable, PressableProps, View } from 'react-native';

export type { PressableProps };

export const Pressable = React.forwardRef<View, PressableProps & { sinEfecto?: boolean }>(function Pressable(
  { style, sinEfecto, ...rest },
  ref
) {
  return (
    <RNPressable
      ref={ref}
      {...rest}
      style={(estado) => [
        typeof style === 'function' ? style(estado) : style,
        estado.pressed && !sinEfecto && !rest.disabled ? { opacity: 0.68 } : null,
      ]}
    />
  );
});
