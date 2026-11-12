// src/screens/ProfileScreen.tsx
// Employee profile, preferences, and account actions.
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Fondo } from '../components/Fondo';
import { Pressable } from '../components/Pressable';
import { LinearGradient } from 'expo-linear-gradient';
import { BearAvatar } from '../components/Bear';
import { Encabezado } from '../components/Encabezado';
import { Icon } from '../components/Icon';
import { TextoLegal } from '../components/TextoLegal';
import { AVISO_PRIVACIDAD, TERMINOS_USO } from '../data/legal';
import { AvisoComposer } from '../components/AvisoComposer';
import { obtenerLlave, puedePublicar } from '../services/sesion';
import { changePin } from '../services/auth';
import { fetchContacts } from '../services/directory';
import { getJson, storageKeys } from '../services/appStorage';
import { confirmAlert, showAlert } from '../utils/alert';
import { colors, gradients, radii, shadows, type, fontFamily, hoja } from '../theme/tokens';

export function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const [session, setSession] = useState<{
    numeroEmpleado: string;
    nombre: string;
    tienda?: string;
    plaza?: string;
    puesto?: string;
    createdAt?: string;
  } | null>(null);

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
      if (!mounted) return;

      setSession(savedSession);
    };

    loadPrefs();

    return () => {
      mounted = false;
    };
  }, []);

  // Logging out  // Logging out erases what is saved on the phone (chat, acta draft, read
  // avisos): one accidental touch must not do it.
  const logout = async () => {
    if (await confirmAlert('Cerrar sesión', 'Se borrará de este teléfono tu historial del chat y el borrador de acta. Para volver a entrar necesitas tu número de empleado y tu PIN.', 'Cerrar sesión')) onLogout();
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
  logout: () => void;
  onPublishNotice: () => void;
  onChangePin: () => void;
  onPrivacyNotice: () => void;
  onTerms: () => void;
  onHelp: () => void;
}) {

  return (
    <View style={styles.screen}>
      <Fondo />

      <Encabezado titulo="Perfil" />

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
            </View>
          </View>

          <View style={styles.infoGrid}>
            <InfoItem label="Empleado" value={session?.numeroEmpleado || '—'} />
            <InfoItem label="Tienda" value={session?.tienda || '—'} />
            <InfoItem label="Plaza" value={session?.plaza || '—'} />
            <InfoItem label="Desde" value={formatSince(session?.createdAt) || '—'} />
          </View>
        </LinearGradient>

        <SectionTitle title="Cuenta" />
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

        <Pressable accessibilityRole="button" style={styles.logoutButton} onPress={logout}>
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

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
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
    <Pressable accessibilityRole="button" style={styles.row} onPress={onPress}>
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
  // Typed twice: a typo would leave the person with a PIN they don't know.
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const noCoinciden = confirmPin.length === 4 && newPin.length === 4 && confirmPin !== newPin;
  const igualAlActual = newPin.length === 4 && newPin === oldPin;
  const ready = oldPin.length === 4 && newPin.length === 4 && confirmPin === newPin && !igualAlActual;

  const reset = () => {
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
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
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.composerSheet, hoja]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.composerTitle}>Cambiar PIN</Text>

          <Text style={styles.composerLabel}>PIN actual</Text>
          <TextInput
            style={styles.composerInput}
            value={oldPin}
            onChangeText={(v) => setOldPin(v.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            accessibilityLabel="PIN actual"
          />

          <Text style={styles.composerLabel}>PIN nuevo</Text>
          <TextInput
            style={styles.composerInput}
            value={newPin}
            onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            accessibilityLabel="PIN nuevo"
          />

          <Text style={styles.composerLabel}>Confirma tu PIN nuevo</Text>
          <TextInput
            style={styles.composerInput}
            value={confirmPin}
            onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            accessibilityLabel="Confirma tu PIN nuevo"
          />
          {noCoinciden ? <Text style={styles.composerError}>Los dos PIN nuevos no coinciden.</Text> : null}
          {igualAlActual ? <Text style={styles.composerError}>El PIN nuevo debe ser distinto al actual.</Text> : null}
          {error ? <Text style={styles.composerError}>{error}</Text> : null}

          <Pressable accessibilityRole="button"
            style={[styles.publishButton, !ready && styles.publishButtonDisabled]}
            onPress={submit}
            disabled={!ready || submitting}
          >
            <Text style={styles.publishButtonText}>{submitting ? 'Guardando...' : 'Guardar PIN'}</Text>
          </Pressable>
        </View>
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
    fontFamily: fontFamily.titulo,
    fontSize: 22,
    lineHeight: 26,
    color: colors.white,
  },
  profileRole: {
    fontFamily: fontFamily.semibold,
    fontSize: 13.5,
    color: 'rgba(255,255,255,.86)',
    marginTop: 3,
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
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: 'rgba(255,255,255,.72)',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: 13.5,
    color: colors.white,
    marginTop: 4,
  },
  sectionTitleRow: {
    marginTop: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fontFamily.titulo,
    fontSize: 17,
    color: colors.ink,
  },
  sectionMeta: {
    fontFamily: fontFamily.bold,
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
    fontFamily: fontFamily.extrabold,
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
    fontFamily: fontFamily.extrabold,
    fontSize: 14.5,
    color: colors.oxRed,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.velo,
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
    fontFamily: fontFamily.titulo,
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
    fontFamily: fontFamily.semibold,
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
    fontFamily: fontFamily.extrabold,
    fontSize: 14.5,
    color: colors.white,
  },

});

