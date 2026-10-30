// src/screens/HomeScreen.tsx
// Post-login dashboard with quick access to the app's main workflows.
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BearAvatar } from '../components/Bear';
import { Icon } from '../components/Icon';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';

type HomeTarget = 'chat' | 'directory' | 'notifications' | 'profile' | 'actas' | 'vacaciones' | 'estructura';

export type ChatHistoryItem = {
  id: string;
  question: string;
  createdAt: string;
};

type HomeScreenProps = {
  onOpenTab: (tab: HomeTarget) => void;
  history: ChatHistoryItem[];
  firstName?: string;
  unreadNotices?: number;
  // Actas y Formatos and Estructura are only for some puestos (see services/actas.ts).
  showActas?: boolean;
};

type QuickAction = {
  title: string;
  desc: string;
  icon: string;
  target: HomeTarget;
  accent: 'oxGrad' | 'blue' | 'green' | 'purple' | 'dark';
};

const ACTAS_ACTION: QuickAction = {
  title: 'Actas y formatos',
  desc: 'Levanta actas, firmas en pantalla y envío a RH.',
  icon: 'clipboard',
  target: 'actas',
  accent: 'dark',
};

const ESTRUCTURA_ACTION: QuickAction = {
  title: 'Estructura',
  desc: 'Posiciones ocupadas y vacantes por tienda.',
  icon: 'chart',
  target: 'estructura',
  accent: 'green',
};

const VACACIONES_ACTION: QuickAction = {
  title: 'Mis vacaciones',
  desc: 'Días que te quedan y cuándo vencen.',
  icon: 'plane',
  target: 'vacaciones',
  accent: 'blue',
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: 'Preguntar al asistente',
    desc: 'Consulta reglamento, permisos y asistencia.',
    icon: 'chat',
    target: 'chat',
    accent: 'oxGrad',
  },
  {
    title: 'Llamar a un área',
    desc: 'Encuentra contactos internos por tema.',
    icon: 'headset',
    target: 'directory',
    accent: 'green',
  },
  {
    title: 'Ver avisos',
    desc: 'Cambios, recordatorios y comunicados.',
    icon: 'bell',
    target: 'notifications',
    accent: 'blue',
  },
  {
    title: 'Mi perfil',
    desc: 'Datos de empleado y preferencias.',
    icon: 'user',
    target: 'profile',
    accent: 'purple',
  },
];


export function HomeScreen({ onOpenTab, history, firstName, unreadNotices = 0, showActas = false }: HomeScreenProps) {
  const actions = [...(showActas ? [ACTAS_ACTION, ESTRUCTURA_ACTION] : []), VACACIONES_ACTION, ...QUICK_ACTIONS];
  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['#FFF7F0', colors.bg, '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View style={styles.identity}>
            <BearAvatar size={52} />
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{firstName ? `Hola, ${firstName}` : 'Buenos días'}</Text>
              <Text style={styles.title}>Inicio</Text>
              <Text style={styles.subtitle}>Todo lo importante de Conoxxo en un solo lugar.</Text>
            </View>
          </View>
          <Pressable style={styles.headerButton} onPress={() => onOpenTab('notifications')}>
            <Icon name="bell" size={20} color={colors.ink} />
            {unreadNotices > 0 ? <View style={styles.headerBadge} /> : null}
          </Pressable>
        </View>
      </SafeAreaView>

      <FlatList
        data={actions}
        keyExtractor={(item) => item.title}
        numColumns={2}
        columnWrapperStyle={styles.actionRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={gradients.oxGrad.colors}
              start={gradients.oxGrad.start}
              end={gradients.oxGrad.end}
              style={styles.hero}
            >
              <View style={styles.heroText}>
                <Text style={styles.heroKicker}>Asistente listo</Text>
                <Text style={styles.heroTitle}>Pregunta, encuentra y resuelve más rápido.</Text>
                <Text style={styles.heroBody}>Puedes empezar con el chat o ir directo al área correcta.</Text>
              </View>
              <View style={styles.heroIcon}>
                <Icon name="sparkle" size={30} color="#fff" />
              </View>
            </LinearGradient>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Accesos rápidos</Text>
              <Text style={styles.sectionMeta}>{actions.length} opciones</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.actionCard} onPress={() => onOpenTab(item.target)}>
            <LinearGradient colors={gradients[item.accent].colors} style={styles.actionIcon}>
              <Icon name={item.icon} size={22} color="#fff" />
            </LinearGradient>
            <Text style={styles.actionTitle}>{item.title}</Text>
            <Text style={styles.actionDesc}>{item.desc}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.recents}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Consultas recientes</Text>
              <Text style={styles.sectionMeta}>{history.length ? `${history.length} guardadas` : 'Vacío'}</Text>
            </View>
            {history.length ? (
              history.map((item) => (
                <Pressable key={item.id} style={styles.recentItem} onPress={() => onOpenTab('chat')}>
                  <Icon name="history" size={18} color={colors.oxRed} />
                  <View style={styles.recentCopy}>
                    <Text style={styles.recentText}>{item.question}</Text>
                    <Text style={styles.recentMeta}>{item.createdAt}</Text>
                  </View>
                  <Icon name="chevR" size={17} color={colors.ink3} />
                </Pressable>
              ))
            ) : (
              <Pressable style={styles.emptyRecent} onPress={() => onOpenTab('chat')}>
                <Icon name="chat" size={20} color={colors.oxRed} />
                <View style={styles.recentCopy}>
                  <Text style={styles.recentText}>Haz tu primera consulta</Text>
                  <Text style={styles.recentMeta}>Aparecerá aquí automáticamente</Text>
                </View>
                <Icon name="chevR" size={17} color={colors.ink3} />
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingBottom: 108,
  },
  safeTop: {
    backgroundColor: 'rgba(255,255,255,.56)',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    ...type.eyebrowSm,
    color: colors.oxRed,
    marginBottom: 3,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 27,
    lineHeight: 30,
    color: colors.ink,
  },
  subtitle: {
    ...type.caption,
    color: colors.ink2,
    marginTop: 3,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  headerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.oxRed,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  hero: {
    minHeight: 150,
    borderRadius: 24,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...shadows.hero,
  },
  heroText: {
    flex: 1,
  },
  heroKicker: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 12,
    color: 'rgba(255,255,255,.84)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 24,
    lineHeight: 28,
    color: colors.white,
  },
  heroBody: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,.86)',
    marginTop: 8,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    marginTop: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 17,
    color: colors.ink,
  },
  sectionMeta: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: colors.ink3,
  },
  actionRow: {
    gap: 10,
    marginBottom: 10,
  },
  actionCard: {
    flex: 1,
    minHeight: 148,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    ...shadows.card,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  actionTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14.5,
    lineHeight: 18,
    color: colors.ink,
  },
  actionDesc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.ink2,
    marginTop: 6,
  },
  recents: {
    marginTop: 4,
  },
  recentItem: {
    minHeight: 56,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 9,
  },
  recentCopy: {
    flex: 1,
  },
  recentMeta: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11.5,
    color: colors.ink3,
    marginTop: 3,
  },
  emptyRecent: {
    minHeight: 62,
    borderRadius: radii.xl,
    backgroundColor: '#FFF0EC',
    borderWidth: 1,
    borderColor: '#FFD2C4',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 9,
  },
  recentText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13.5,
    color: colors.ink,
  },
});



