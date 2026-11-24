// src/components/ZonaTexto.tsx
// The text part of the login / registration screens. On a short screen it
// scrolls, so the keypad always fits above the Continuar button, and it stays
// scrolled to the end: the field being typed (always the last one) is visible.
import React, { useRef } from 'react';
import { ScrollView } from 'react-native';

export function ZonaTexto({ children }: { children: React.ReactNode }) {
  const ref = useRef<ScrollView>(null);
  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 8 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}
      onLayout={() => ref.current?.scrollToEnd({ animated: false })}
    >
      {children}
    </ScrollView>
  );
}
