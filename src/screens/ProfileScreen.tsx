// src/screens/ProfileScreen.tsx
// Employee profile, preferences, and account actions.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BearAvatar } from '../components/Bear';
import { Icon } from '../components/Icon';
import { TextoLegal } from '../components/TextoLegal';
import { AVISO_PRIVACIDAD, TERMINOS_USO } from '../data/legal';
import { AvisoComposer } from '../components/AvisoComposer';
import { obtenerLlave, puedePublicar } from '../services/sesion';
import { changePin } from '../services/auth';
import { fetchContacts } from '../services/directory';
import { getJson, storageKeys } from '../services/appStorage';
import { showAlert } from '../utils/alert';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';

export function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const [session, setSession] = useState<{
    numeroEmpleado: string;
    nombre: string;
    tienda?: string;
    plaza?: string;
    puesto?: string;
    createdAt?: string;
  } | null>(null);
  const [consultas, setConsultas] = useState(0);
  const [avisosLeidos, setAvisosLeidos] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadPrefs = async () => {
      const savedSession = await getJson<{
        numeroEmpleado: string;
        nombre: string;
        tienda?: string;
        plaza?: string;
        puesto?: string;
        createdAt?: string;
      } | null>(storageKeys.session, null);
      const questionCount = await getJson<number>(storageKeys.chatQuestionCount, 0);
      const noticeReadState = await getJson<Record<string, boolean>>(storageKeys.noticeReadState, {});
      if (!mounted) return;

      setSession(savedSession);
      setConsultas(questionCount);
      setAvisosLeidos(Object.values(noticeReadState).filter(Boolean).length);
    };

    loadPrefs();

    return () => {
      mounted = false;
    };
  }, []);

  const profileFields = [session?.nombre, session?.tienda, session?.plaza];
  const profileCompletion = Math.round(
    (profileFields.filter(Boolean).length / profileFields.length) * 100
  );
  const stats = [
    { label: 'Consultas', value: String(consultas) },
    { label: 'Avisos leídos', value: String(avisosLeidos) },
    { label: 'Perfil', value: `${profileCompletion}%` },
  ];

  const logout = () => {
    onLogout();
  };

  const [noticeModal, setNoticeModal] = useState(false);
  const [pinModal, setPinModal] = useState(false);

  const showHelp = () => {
    fetchContacts()
      .then((contacts) => {
        const lines = contacts.map((c) => `${c.name} (${c.area}): ${c.phone}`).join('\n');
        showAlert('Ayuda y soporte', lines);
      })
      .catch(() => showAlert('Ayuda y soporte', 'No pudimos cargar los contactos. Intenta de nuevo.'));
  };

  const [legal, setLegal] = useState<'privacidad' | 'terminos' | null>(null);

  return (
    <>
      <ProfileBody
        session={session}
        stats={stats}
        logout={logout}
        onPublishNotice={() => setNoticeModal(true)}
        onChangePin={() => setPinModal(true)}
        onPrivacyNotice={() => setLegal('privacidad')}
        onTerms={() => setLegal('terminos')}
        onHelp={showHelp}
      />
      <AvisoComposer
        visible={noticeModal}
        numeroEmpleado={session?.numeroEmpleado ?? ''}
        onClose={() => setNoticeModal(false)}
      />
      {legal ? (
        <TextoLegal
          titulo={legal === 'privacidad' ? 'Aviso de privacidad' : 'Términos de uso'}
          parrafos={legal === 'privacidad' ? AVISO_PRIVACIDAD : TERMINOS_USO}
          onClose={() => setLegal(null)}
        />
      ) : null}
      <ChangePinModal
        visible={pinModal}
        numeroEmpleado={session?.numeroEmpleado ?? ''}
        onClose={() => setPinModal(false)}
      />
    </>
  );
}

function ProfileBody({
  session,
  stats,
  logout,
  onPublishNotice,
  onChangePin,
  onPrivacyNotice,
  onTerms,
  onHelp,
}: {
  session: {
    numeroEmpleado: string;
    nombre: string;
    tienda?: string;
    plaza?: string;
    puesto?: string;
    createdAt?: string;
  } | null;
  stats: Array<{ label: string; value: string }>;
  logout: () => void;
  onPublishNotice: () => void;
  onChangePin: () => void;
  onPrivacyNotice: () => void;
  onTerms: () => void;
  onHelp: () => void;
}) {

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
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Cuenta verificada</Text>
            <Text style={styles.title}>Perfil</Text>
            <Text style={styles.subtitle}>Datos del colaborador y preferencias de app.</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={gradients.oxGrad.colors}
          start={gradients.oxGrad.start}
          end={gradients.oxGrad.end}
          style={styles.profileCard}
        >
          <View style={styles.profileTop}>
            <BearAvatar size={64} bg="rgba(255,255,255,.88)" />
            <View style={styles.profileCopy}>
              <Text style={styles.profileName}>{session?.nombre || '—'}</Text>
              <Text style={styles.profileRole}>{session?.puesto || ''}</Text>
              <View style={styles.verifiedPill}>
                <Icon name="shieldCheck" size={14} color={colors.oxRed} />
                <Text style={styles.verifiedText}>Verificado</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <InfoItem label="Empleado" value={session?.numeroEmpleado || '—'} />
            <InfoItem label="Tienda" value={session?.tienda || '—'} />
            <InfoItem label="Plaza" value={session?.plaza || '—'} />
            <InfoItem label="Desde" value={formatSince(session?.createdAt) || '—'} />
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          {stats.map((item) => (
            <View style={styles.statCard} key={item.label}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <SectionTitle title="Cuenta" meta="Acciones" />
        <View style={styles.sectionCard}>
          <ActionRow
            title="Cambiar PIN"
            desc="Actualiza tu clave de 4 dígitos"
            icon="key"
            onPress={onChangePin}
          />
          <View style={styles.divider} />
          <ActionRow
            title="Aviso de privacidad"
            desc="Qué datos usa la app y para qué"
            icon="doc"
            onPress={onPrivacyNotice}
          />
          <View style={styles.divider} />
          <ActionRow title="Términos de uso" desc="Reglas para usar Conoxxo" icon="book" onPress={onTerms} />
          <View style={styles.divider} />
          <ActionRow title="Ayuda y soporte" desc="Contacta al equipo interno" icon="help" onPress={onHelp} />
          {/* RH and Gerente de plaza only (services/sesion.ts). */}
          {puedePublicar(session?.puesto) ? (
            <>
              <View style={styles.divider} />
              <ActionRow
                title="Publicar aviso"
                desc="Escribe un comunicado para todos los colaboradores"
                icon="bell"
                onPress={onPublishNotice}
              />
            </>
          ) : null}
        </View>

        <Pressable style={styles.logoutButton} onPress={logout}>
          <Icon name="logout" size={19} color={colors.oxRed} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function formatSince(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' }).format(d);
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({ title, meta }: { title: string; meta: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionMeta}>{meta}</Text>
    </View>
  );
}

function ActionRow({
  title,
  desc,
  icon,
  onPress,
}: {
  title: string;
  desc: string;
  icon: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={20} color={colors.oxRed} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <Icon name="chevR" size={18} color={colors.ink3} />
    </Pressable>
  );
}

function ChangePinModal({
  visible,
  numeroEmpleado,
  onClose,
}: {
  visible: boolean;
  numeroEmpleado: string;
  onClose: () => void;
}) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const ready = oldPin.length === 4 && newPin.length === 4;

  const reset = () => {
    setOldPin('');
    setNewPin('');
    setError('');
  };

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const status = await changePin(numeroEmpleado, oldPin, newPin);
      if (status === 'ok') {
        // A PIN change ends the session key (migration 35); get a new one.
        obtenerLlave(numeroEmpleado, newPin).catch(() => {});
        reset();
        onClose();
        showAlert('PIN actualizado', 'Tu nuevo PIN ya está activo.');
      } else if (status === 'wrong_pin') {
        setError('Tu PIN actual no es correcto.');
      } else if (status === 'locked') {
        setError('Cuenta bloqueada por varios intentos fallidos. Intenta más tarde.');
      } else if (status === 'weak_pin') {
        setError('Ese PIN es muy fácil de adivinar (como 1234 o 0000). Elige otro.');
      } else {
        setError('No pudimos actualizar tu PIN.');
      }
    } catch {
      setError('No pudimos conectar. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <BlurView intensity={36} tint="light" style={styles.composerSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.composerTitle}>Cambiar PIN</Text>

          <Text style={styles.composerLabel}>PIN actual</Text>
          <TextInput
            style={styles.composerInput}
            value={oldPin}
            onChangeText={(v) => setOldPin(v.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor={colors.ink3}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
          />

          <Text style={styles.composerLabel}>PIN nuevo</Text>
          <TextInput
            style={styles.composerInput}
            value={newPin}
            onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor={colors.ink3}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
          />
          {error ? <Text style={styles.composerError}>{error}</Text> : null}

          <Pressable
            style={[styles.publishButton, !ready && styles.publishButtonDisabled]}
            onPress={submit}
            disabled={!ready || submitting}
          >
            <Text style={styles.publishButtonText}>{submitting ? 'Guardando...' : 'Guardar PIN'}</Text>
          </Pressable>
        </BlurView>
      </View>
    </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  eyebrow: {
    ...type.eyebrowSm,
    color: colors.oxRed,
    marginBottom: 7,
  },
  title: {
    ...type.title,
    color: colors.ink,
  },
  subtitle: {
    ...type.bodySm,
    color: colors.ink2,
    marginTop: 8,
    maxWidth: 300,
  },
  headerButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  profileCard: {
    borderRadius: 26,
    padding: 18,
    ...shadows.hero,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileCopy: {
    flex: 1,
  },
  profileName: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    lineHeight: 26,
    color: colors.white,
  },
  profileRole: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13.5,
    color: 'rgba(255,255,255,.86)',
    marginTop: 3,
  },
  verifiedPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 12,
    color: colors.oxRed,
  },
  infoGrid: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoItem: {
    width: '48%',
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.28)',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  infoLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: 'rgba(255,255,255,.72)',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 13.5,
    color: colors.white,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    minHeight: 74,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    ...shadows.card,
  },
  statValue: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 21,
    color: colors.oxRed,
  },
  statLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11.5,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 3,
  },
  sectionTitleRow: {
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
  sectionCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    ...shadows.card,
  },
  row: {
    minHeight: 74,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14.5,
    color: colors.ink,
  },
  rowDesc: {
    ...type.bodySm,
    color: colors.ink2,
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginLeft: 68,
  },
  logoutButton: {
    minHeight: 54,
    borderRadius: radii.xl,
    backgroundColor: '#FFF0EC',
    borderWidth: 1,
    borderColor: '#FFD2C4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 18,
  },
  logoutText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14.5,
    color: colors.oxRed,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(36,26,23,.24)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.line2,
    marginBottom: 14,
  },
  composerSheet: {
    maxHeight: '86%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.96)',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    ...shadows.sheet,
  },
  composerTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 20,
    color: colors.ink,
    marginBottom: 14,
  },
  composerLabel: {
    ...type.label,
    color: colors.ink,
    marginBottom: 8,
    marginTop: 12,
  },
  composerInput: {
    minHeight: 50,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14.5,
    color: colors.ink,
  },
  composerError: {
    ...type.caption,
    color: colors.oxRed,
    marginTop: 10,
  },
  publishButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.oxRed,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  publishButtonDisabled: {
    opacity: 0.5,
  },
  publishButtonText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14.5,
    color: colors.white,
  },
});

