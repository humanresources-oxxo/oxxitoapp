// src/components/Encabezado.tsx
// The header every screen shares: optional back button, a short eyebrow, the
// title and, on the right, the screen's own actions.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { colors, fontFamily, sombraVidrio, type, vidrio } from '../theme/tokens';

export function Encabezado({
  titulo,
  eyebrow,
  nota,
  onBack,
  children,
}: {
  titulo: string;
  eyebrow?: string;
  // One short line under the title, only when it says something that changes.
  nota?: string;
  onBack?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.fila}>
        {onBack ? <BotonEncabezado icono="chevL" etiqueta="Regresar" onPress={onBack} /> : null}
        <View style={styles.copy}>
          {eyebrow ? (
            <Text style={styles.eyebrow} numberOfLines={1}>
              {eyebrow}
            </Text>
          ) : null}
          <Text style={styles.titulo} numberOfLines={1}>
            {titulo}
          </Text>
          {nota ? <Text style={styles.nota}>{nota}</Text> : null}
        </View>
        {children ? <View style={styles.acciones}>{children}</View> : null}
      </View>
    </SafeAreaView>
  );
}

// Square 44 pt button for the header. With texto it becomes a labelled pill.
export function BotonEncabezado({
  icono,
  etiqueta,
  texto,
  principal,
  onPress,
}: {
  icono: string;
  etiqueta: string;
  texto?: string;
  principal?: boolean;
  onPress: () => void;
}) {
  const color = principal ? colors.white : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      style={[styles.boton, texto ? styles.botonTexto : styles.botonCuadrado, principal && styles.botonPrincipal]}
      onPress={onPress}
    >
      <Icon name={icono} size={texto ? 17 : 20} color={color} />
      {texto ? <Text style={[styles.botonEtq, { color }]}>{texto}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: 'rgba(255,255,255,.3)' },
  fila: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1 },
  eyebrow: { ...type.eyebrowSm, color: colors.oxRed, marginBottom: 2 },
  titulo: { fontFamily: fontFamily.extrabold, fontSize: 25, lineHeight: 30, letterSpacing: -0.4, color: colors.ink },
  nota: { ...type.caption, color: colors.ink2, marginTop: 2 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boton: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...vidrio,
    backgroundColor: 'rgba(255,255,255,.8)',
    ...sombraVidrio,
  },
  botonCuadrado: { width: 44 },
  botonTexto: { paddingHorizontal: 15, flexDirection: 'row', gap: 6 },
  botonPrincipal: { backgroundColor: colors.oxRed, borderColor: colors.oxRed },
  botonEtq: { fontFamily: fontFamily.bold, fontSize: 13.5 },

});
