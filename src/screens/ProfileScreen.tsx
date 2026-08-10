// src/screens/ProfileScreen.tsx
// Employee profile, preferences, and account actions.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BearAvatar } from '../components/Bear';
import { Icon } from '../components/Icon';
import { PreferenceKey, employeeProfile, profileSettings } from '../data/employee';
import { NoticeKind, noticeKindMeta } from '../data/notices';
import { createNotice } from '../services/notices';
import { changePin } from '../services/auth';
import { fetchContacts } from '../services/directory';
import { getJson, setJson, storageKeys } from '../services/appStorage';
import { showAlert } from '../utils/alert';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';

const PRIVACY_NOTICE =
  'Segun el Articulo 75, fraccion X del Reglamento Interior de Trabajo: la Empresa se compromete a llevar y mantener actualizados los registros administrativos y expedientes laborales de los Trabajadores, asi como resguardar y tratar la informacion de manera confidencial y conforme a la legislacion en materia de proteccion de datos personales.\n\nPara el aviso de privacidad completo, contacta a Recursos Humanos.';


export function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const [prefs, setPrefs] = useState<Record<PreferenceKey, boolean>>({
    push: true,
    privacy: true,
    biometric: false,
  });
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
      const saved = await getJson<Partial<Record<PreferenceKey, boolean>>>(storageKeys.profilePrefs, {});
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

      setPrefs((current) => ({ ...current, ...saved }));
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
    { label: 'Avisos leidos', value: String(avisosLeidos) },
    { label: 'Perfil', value: `${profileCompletion}%` },
  ];

  const togglePref = (key: PreferenceKey) => {
    setPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      setJson(storageKeys.profilePrefs, next);
      return next;
    });
  };
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

  const showPrivacy = () => {
    showAlert('Aviso de privacidad', PRIVACY_NOTICE);
  };

  return (
    <>
      <ProfileBody
        session={session}
        stats={stats}
        prefs={prefs}
        togglePref={togglePref}
        logout={logout}
        onPublishNotice={() => setNoticeModal(true)}
        onChangePin={() => setPinModal(true)}
        onPrivacyNotice={showPrivacy}
        onHelp={showHelp}
      />
      <NoticeComposer visible={noticeModal} onClose={() => setNoticeModal(false)} />
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
  prefs,
  togglePref,
  logout,
  onPublishNotice,
  onChangePin,
  onPrivacyNotice,
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
  prefs: Record<PreferenceKey, boolean>;
  togglePref: (key: PreferenceKey) => void;
  logout: () => void;
  onPublishNotice: () => void;
  onChangePin: () => void;
  onPrivacyNotice: () => void;
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
          <View>
            <Text style={styles.eyebrow}>Cuenta verificada</Text>
            <Text style={styles.title}>Perfil</Text>
            <Text style={styles.subtitle}>Datos del colaborador y preferencias de app.</Text>
          </View>
          <Pressable style={styles.headerButton}>
            <Icon name="settings" size={20} color={colors.ink} />
          </Pressable>
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
              <Text style={styles.profileName}>{session?.nombre || employeeProfile.name}</Text>
              <Text style={styles.profileRole}>{session?.puesto || employeeProfile.role}</Text>
              <View style={styles.verifiedPill}>
                <Icon name="shieldCheck" size={14} color={colors.oxRed} />
                <Text style={styles.verifiedText}>Verificado</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <InfoItem label="Empleado" value={session?.numeroEmpleado || employeeProfile.employeeId} />
            <InfoItem label="Tienda" value={session?.tienda || employeeProfile.store} />
            <InfoItem label="Plaza" value={session?.plaza || employeeProfile.area} />
            <InfoItem label="Desde" value={formatSince(session?.createdAt) || employeeProfile.since} />
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

        <SectionTitle title="Preferencias" meta="3 ajustes" />
        <View style={styles.sectionCard}>
          {profileSettings.map((item, index) => (
            <View key={item.key}>
              <SettingRow
                title={item.title}
                desc={item.desc}
                icon={item.icon}
                enabled={prefs[item.key]}
                onToggle={() => togglePref(item.key)}
              />
              {index < profileSettings.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>

        <SectionTitle title="Cuenta" meta="Acciones" />
        <View style={styles.sectionCard}>
          <ActionRow
            title="Cambiar PIN"
            desc="Actualiza tu clave de 4 digitos"
            icon="key"
            onPress={onChangePin}
          />
          <View style={styles.divider} />
          <ActionRow
            title="Aviso de privacidad"
            desc="Consulta terminos y uso de datos"
            icon="doc"
            onPress={onPrivacyNotice}
          />
          <View style={styles.divider} />
          <ActionRow title="Ayuda y soporte" desc="Contacta al equipo interno" icon="help" onPress={onHelp} />
          <View style={styles.divider} />
          <ActionRow
            title="Publicar aviso"
            desc="Escribe un comunicado para todos los colaboradores"
            icon="bell"
            onPress={onPublishNotice}
          />
        </View>

        <Pressable style={styles.logoutButton} onPress={logout}>
          <Icon name="logout" size={19} color={colors.oxRed} />
          <Text style={styles.logoutText}>Cerrar sesion</Text>
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

function SettingRow({
  title,
  desc,
  icon,
  enabled,
  onToggle,
}: {
  title: string;
  desc: string;
  icon: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={20} color={colors.oxRed} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <Toggle enabled={enabled} onPress={onToggle} />
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
        reset();
        onClose();
        showAlert('PIN actualizado', 'Tu nuevo PIN ya esta activo.');
      } else if (status === 'wrong_pin') {
        setError('Tu PIN actual no es correcto.');
      } else if (status === 'locked') {
        setError('Cuenta bloqueada por varios intentos fallidos. Intenta mas tarde.');
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

const NOTICE_KINDS: NoticeKind[] = ['policy', 'training', 'schedule', 'benefit'];

function NoticeComposer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<NoticeKind>('policy');
  const [priority, setPriority] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const ready = title.trim().length > 2 && body.trim().length > 2 && passcode.length > 0;

  const reset = () => {
    setTitle('');
    setBody('');
    setKind('policy');
    setPriority(false);
    setPasscode('');
    setError('');
  };

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await createNotice(passcode, title.trim(), body.trim(), kind, priority);
      reset();
      onClose();
      showAlert('Aviso publicado', 'Ya esta visible para todos los colaboradores.');
    } catch (e: any) {
      const message = typeof e?.message === 'string' ? e.message : '';
      setError(message.includes('invalid_passcode') ? 'Passcode incorrecto.' : 'No pudimos publicar el aviso.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <BlurView intensity={36} tint="light" style={styles.composerSheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.sheetHandle} />
            <Text style={styles.composerTitle}>Publicar aviso</Text>

            <Text style={styles.composerLabel}>Titulo</Text>
            <TextInput
              style={styles.composerInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Actualizacion de puntualidad"
              placeholderTextColor={colors.ink3}
            />

            <Text style={styles.composerLabel}>Mensaje</Text>
            <TextInput
              style={[styles.composerInput, styles.composerTextarea]}
              value={body}
              onChangeText={setBody}
              placeholder="Escribe el comunicado completo"
              placeholderTextColor={colors.ink3}
              multiline
            />

            <Text style={styles.composerLabel}>Categoria</Text>
            <View style={styles.kindRow}>
              {NOTICE_KINDS.map((k) => (
                <Pressable
                  key={k}
                  style={[styles.kindChip, kind === k && styles.kindChipActive]}
                  onPress={() => setKind(k)}
                >
                  <Text style={[styles.kindChipText, kind === k && styles.kindChipTextActive]}>
                    {noticeKindMeta[k].label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.priorityRow} onPress={() => setPriority(!priority)}>
              <View style={[styles.checkBox, !priority && styles.checkBoxEmpty]}>
                {priority ? <Icon name="check" size={14} color="#fff" /> : null}
              </View>
              <Text style={styles.composerLabel}>Marcar como prioritario</Text>
            </Pressable>

            <Text style={styles.composerLabel}>Passcode</Text>
            <TextInput
              style={styles.composerInput}
              value={passcode}
              onChangeText={setPasscode}
              placeholder="Passcode de RH"
              placeholderTextColor={colors.ink3}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {error ? <Text style={styles.composerError}>{error}</Text> : null}

            <Pressable
              style={[styles.publishButton, !ready && styles.publishButtonDisabled]}
              onPress={submit}
              disabled={!ready || submitting}
            >
              <Text style={styles.publishButtonText}>{submitting ? 'Publicando...' : 'Publicar'}</Text>
            </Pressable>
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
}

function Toggle({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.toggle, enabled && styles.toggleOn]}
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
    >
      <View style={[styles.toggleKnob, enabled && styles.toggleKnobOn]} />
    </Pressable>
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
  toggle: {
    width: 48,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: colors.line2,
    padding: 3,
  },
  toggleOn: {
    backgroundColor: colors.oxRed,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  toggleKnobOn: {
    transform: [{ translateX: 18 }],
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
  composerTextarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kindChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  kindChipActive: {
    backgroundColor: colors.oxRed,
    borderColor: colors.oxRed,
  },
  kindChipText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: colors.ink2,
  },
  kindChipTextActive: {
    color: colors.white,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.oxRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.line2,
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

