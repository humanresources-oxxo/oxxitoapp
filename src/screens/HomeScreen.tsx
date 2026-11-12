// src/screens/HomeScreen.tsx
// Inicio: what the employee came for goes first — ask the reglamento, their
// own numbers (vacation days, unread avisos, open votaciones) — and the
// management tools of the puestos with permissions go in one list below.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BearAvatar } from '../components/Bear';
import { Fondo } from '../components/Fondo';
import { Icon } from '../components/Icon';
import { Pressable } from '../components/Pressable';
import { colors, fontFamily, gradients, radii, sombraVidrio, type, vidrio } from '../theme/tokens';

export type HomeTarget =
  | 'chat'
  | 'directory'
  | 'notifications'
  | 'profile'
  | 'actas'
  | 'vacaciones'
  | 'estructura'
  | 'cuota'
  | 'cct'
  | 'dilos'
  | 'votaciones'
  | 'altas'
  | 'resumen';

export type ChatHistoryItem = {
  id: string;
  question: string;
  createdAt: string;
};

type HomeScreenProps = {
  onOpenTab: (tab: HomeTarget) => void;
  // A recent question: opens the chat and asks it again.
  onAsk: (question: string) => void;
  history: ChatHistoryItem[];
  firstName?: string;
  unreadNotices?: number;
  // Actas y Formatos, Estructura, Cuota sindical and Contratos colectivos are only for some puestos (see services/actas.ts).
  showActas?: boolean;
  // Resumen (Ficha de Plaza): the puestos above plus every office puesto.
  showResumen?: boolean;
  // Open votaciones the employee hasn't voted in yet; null hides the tile
  // (backend not reachable, e.g. offline).
  pendingVotes?: number | null;
  // Approvers (asesor, RH, Gerente): the row, with how many are waiting.
  showAltas?: boolean;
  pendingAltas?: number;
  // Own vacation days left; null while unknown.
  vacationDays?: number | null;
};

type Herramienta = { title: string; desc: string; icon: string; target: HomeTarget; badge?: number };

export function HomeScreen({
  onOpenTab,
  onAsk,
  history,
  firstName,
  unreadNotices = 0,
  showActas = false,
  showResumen = false,
  pendingVotes = null,
  showAltas = false,
  pendingAltas = 0,
  vacationDays = null,
}: HomeScreenProps) {
  const herramientas: Herramienta[] = [
    ...(showAltas ? [{ title: 'Altas por aprobar', desc: 'Cuentas nuevas de tu gente', icon: 'user', target: 'altas' as const, badge: pendingAltas }] : []),
    ...(showResumen ? [{ title: 'Resumen de plaza', desc: 'Vacantes, bajas y uso de estructura', icon: 'grid', target: 'resumen' as const }] : []),
    ...(showActas
      ? [
          { title: 'Actas y formatos', desc: 'Levanta actas, firma en pantalla y envía a RH', icon: 'clipboard', target: 'actas' as const },
          { title: 'Estructura', desc: 'Posiciones ocupadas y vacantes por tienda', icon: 'chart', target: 'estructura' as const },
          { title: 'Cuota sindical', desc: 'Lo descontado por mes, tienda y puesto', icon: 'shield', target: 'cuota' as const },
          { title: 'Contratos colectivos', desc: 'Revisión, aumento y comparativo nacional', icon: 'book', target: 'cct' as const },
          { title: 'Casos DILOS', desc: 'Casos abiertos de la Zona Centro Sur', icon: 'message', target: 'dilos' as const },
        ]
      : []),
  ];

  const dias = vacationDays === null ? null : Number.isInteger(vacationDays) ? String(vacationDays) : vacationDays.toFixed(1);

  return (
    <View style={styles.screen}>
      <Fondo />

      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <BearAvatar size={46} />
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Conoxxo · Plaza Oaxaca</Text>
            <Text style={styles.title} numberOfLines={1}>
              {firstName ? `Hola, ${firstName}` : 'Hola'}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Ask the reglamento: the main thing the app is for. */}
        <Pressable accessibilityRole="button" accessibilityLabel="Preguntar al reglamento" style={styles.ask} onPress={() => onOpenTab('chat')}>
          <Icon name="sparkle" size={21} color={colors.oxRed} fill />
          <Text style={styles.askText} numberOfLines={1}>
            Pregúntale al reglamento…
          </Text>
          <LinearGradient colors={gradients.oxGrad.colors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.askSend}>
            <Icon name="arrowR" size={18} color={colors.white} strokeWidth={2.2} />
          </LinearGradient>
        </Pressable>

        {history.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recents} style={styles.recentsWrap}>
            {history.slice(0, 5).map((item) => (
              <Pressable accessibilityRole="button" key={item.id} style={styles.recent} onPress={() => onAsk(item.question)}>
                <Icon name="history" size={15} color={colors.ink2} />
                <Text style={styles.recentText} numberOfLines={1}>
                  {item.question}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Text style={styles.sectionTitle}>Para ti</Text>
        <View style={styles.tiles}>
          <Tile
            icon="plane"
            value={dias ?? 'Ver'}
            label={dias === null ? 'Mis vacaciones' : dias === '1' ? 'día de vacaciones' : 'días de vacaciones'}
            onPress={() => onOpenTab('vacaciones')}
          />
          <Tile
            icon="bell"
            value={String(unreadNotices)}
            label={unreadNotices === 1 ? 'aviso sin leer' : 'avisos sin leer'}
            highlight={unreadNotices > 0}
            onPress={() => onOpenTab('notifications')}
          />
          {pendingVotes !== null ? (
            <Tile
              icon="check"
              value={String(pendingVotes)}
              label={pendingVotes === 1 ? 'votación por votar' : 'votaciones por votar'}
              highlight={pendingVotes > 0}
              onPress={() => onOpenTab('votaciones')}
            />
          ) : null}
        </View>

        {herramientas.length ? (
          <>
            <Text style={styles.sectionTitle}>Gestión</Text>
            <View style={styles.list}>
              {herramientas.map((h, i) => (
                <Pressable
                  accessibilityRole="button"
                  key={h.target}
                  style={[styles.row, i > 0 && styles.rowLine]}
                  onPress={() => onOpenTab(h.target)}
                >
                  <View style={styles.rowIcon}>
                    <Icon name={h.icon} size={20} color={colors.oxRedDark} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{h.title}</Text>
                    <Text style={styles.rowDesc} numberOfLines={1}>
                      {h.desc}
                    </Text>
                  </View>
                  {h.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{h.badge}</Text>
                    </View>
                  ) : null}
                  <Icon name="chevR" size={17} color={colors.ink3} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Tile({ icon, value, label, highlight, onPress }: { icon: string; value: string; label: string; highlight?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${value} ${label}`} style={[styles.tile, highlight && styles.tileOn]} onPress={onPress}>
      {highlight ? (
        <LinearGradient colors={gradients.oxGrad.colors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.tileIcon}>
          <Icon name={icon} size={18} color={colors.white} strokeWidth={2.1} />
        </LinearGradient>
      ) : (
        <View style={[styles.tileIcon, styles.tileIconOff]}>
          <Icon name={icon} size={18} color={colors.ink2} />
        </View>
      )}
      <Text style={[styles.tileValue, highlight && { color: colors.oxRed }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingBottom: 108,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: { flex: 1 },
  eyebrow: { ...type.eyebrowSm, color: colors.oxRed, marginBottom: 2 },
  title: { fontFamily: fontFamily.titulo, fontSize: 25, lineHeight: 30, letterSpacing: -0.2, color: colors.ink },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 20 },
  ask: {
    minHeight: 60,
    borderRadius: 30,
    ...vidrio,
    backgroundColor: 'rgba(255,255,255,.78)',
    paddingLeft: 18,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...sombraVidrio,
  },
  askText: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 15.5, color: colors.ink2 },
  askSend: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  recentsWrap: { marginHorizontal: -16, marginTop: 10 },
  recents: { paddingHorizontal: 16, gap: 8 },
  recent: {
    maxWidth: 240,
    minHeight: 44,
    borderRadius: radii.pill,
    ...vidrio,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  recentText: { flexShrink: 1, fontFamily: fontFamily.semibold, fontSize: 13.5, color: colors.ink },
  sectionTitle: { fontFamily: fontFamily.titulo, fontSize: 17, color: colors.ink, marginTop: 22, marginBottom: 10 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    minHeight: 124,
    borderRadius: 24,
    ...vidrio,
    backgroundColor: 'rgba(255,255,255,.7)',
    padding: 12,
    ...sombraVidrio,
  },
  tileOn: { backgroundColor: 'rgba(255,255,255,.88)' },
  tileIcon: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tileIconOff: { backgroundColor: 'rgba(36,26,23,.06)' },
  tileValue: { fontFamily: fontFamily.titulo, fontSize: 28, lineHeight: 34, letterSpacing: -0.2, color: colors.ink, marginTop: 8 },
  tileLabel: { fontFamily: fontFamily.semibold, fontSize: 12.5, lineHeight: 16, color: colors.ink2, marginTop: 2 },
  list: {
    borderRadius: 24,
    ...vidrio,
    backgroundColor: 'rgba(255,255,255,.8)',
    overflow: 'hidden',
  },
  row: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLine: { borderTopWidth: 1, borderTopColor: 'rgba(36,26,23,.07)' },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFE9E2', alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.ink },
  rowDesc: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.ink2, marginTop: 2 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: colors.oxRed, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fontFamily.extrabold, fontSize: 12.5, color: colors.white },

});
