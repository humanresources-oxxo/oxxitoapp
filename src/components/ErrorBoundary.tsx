// src/components/ErrorBoundary.tsx
// If a screen throws while drawing, show a recoverable message instead of a
// blank app. onReset: what "Volver a intentar" does (e.g. go to Inicio).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';
import { Icon } from './Icon';
import { colors, radii, type, fontFamily } from '../theme/tokens';

type Props = { children: React.ReactNode; onReset?: () => void };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Pantalla con error:', error);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.fondo}>
        <View style={styles.tarjeta}>
          <Icon name="alert" size={30} color={colors.oxRed} />
          <Text style={styles.titulo}>Algo salió mal</Text>
          <Text style={styles.texto}>Esta pantalla tuvo un problema. Vuelve a intentar; si sigue pasando, avisa a Soporte de la App en el Directorio.</Text>
          <Pressable style={styles.boton} onPress={this.reset} accessibilityRole="button">
            <Text style={styles.botonTexto}>Volver a intentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tarjeta: { alignItems: 'center', gap: 10, padding: 24, borderRadius: radii.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, maxWidth: 360 },
  titulo: { fontFamily: fontFamily.titulo, fontSize: 18, color: colors.ink },
  texto: { ...type.caption, color: colors.ink2, textAlign: 'center' },
  boton: { marginTop: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radii.pill, backgroundColor: colors.oxRed },
  botonTexto: { fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.white },

});
