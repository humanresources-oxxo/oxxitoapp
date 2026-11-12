// src/components/AvisoComposer.tsx
// Sheet to publish an aviso (RH and Gerente de plaza): title, text, category,
// priority and up to 3 images, compressed on the phone before sending
// (services/notices.ts prepararImagen). Goes with the session key; a session
// from before the key existed asks for the PIN once. Used from Avisos and
// from Perfil. "Mejorar redacción" asks Claude Haiku for a cleaner title and
// text (services/redactar.ts) and shows it as a suggestion to use or discard.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from './Pressable';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from './Icon';
import { NoticeKind, noticeKindMeta } from '../data/notices';
import { ImagenNueva, prepararImagen, publishNotice } from '../services/notices';
import { mejorarRedaccion, Sugerencia } from '../services/redactar';
import { leerLlave, obtenerLlave, olvidarLlave } from '../services/sesion';
import { colors, radii, shadows, type, fontFamily, hoja } from '../theme/tokens';
import { showAlert } from '../utils/alert';

const KINDS: NoticeKind[] = ['policy', 'training', 'schedule', 'benefit'];
const MAX_IMAGENES = 3;

export function AvisoComposer({
  visible,
  numeroEmpleado,
  onClose,
  onPublished,
}: {
  visible: boolean;
  numeroEmpleado: string;
  onClose: () => void;
  onPublished?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<NoticeKind>('policy');
  const [priority, setPriority] = useState(false);
  const [images, setImages] = useState<ImagenNueva[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [pin, setPin] = useState('');
  const [sinLlave, setSinLlave] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mejorando, setMejorando] = useState(false);
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [avisoIa, setAvisoIa] = useState('');

  useEffect(() => {
    if (visible) leerLlave().then((l) => setSinLlave(!l));
  }, [visible]);

  // With images the text is optional (a flyer).
  const ready =
    title.trim().length > 2 && (body.trim().length > 2 || images.length > 0) && !preparing && (!sinLlave || pin.length === 4);

  const reset = () => {
    setTitle('');
    setBody('');
    setKind('policy');
    setPriority(false);
    setImages([]);
    setPin('');
    setError('');
    setSugerencia(null);
    setAvisoIa('');
  };

  const mejorar = async () => {
    if (mejorando || body.trim().length < 10) return;
    setMejorando(true);
    setAvisoIa('');
    setSugerencia(null);
    const r = await mejorarRedaccion(title.trim(), body.trim());
    setMejorando(false);
    if (r.ok) return setSugerencia(r.sugerencia);
    setAvisoIa(
      r.motivo === 'no_activa'
        ? 'La ayuda de redacción todavía no está activa.'
        : r.motivo === 'sin_sesion'
          ? 'Confirma tu PIN publicando una vez y vuelve a intentarlo.'
          : r.motivo === 'limite'
            ? 'Llegaste al límite de mejoras de hoy.'
            : r.motivo === 'no_habilitado'
              ? 'Tu puesto no puede publicar avisos.'
              : 'No pudimos mejorar la redacción. Intenta de nuevo.'
    );
  };

  const addImages = async () => {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGENES - images.length,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;
    setPreparing(true);
    try {
      const nuevas: ImagenNueva[] = [];
      for (const a of result.assets.slice(0, MAX_IMAGENES - images.length)) {
        nuevas.push(await prepararImagen(a.uri, a.width, a.height));
      }
      setImages((xs) => [...xs, ...nuevas].slice(0, MAX_IMAGENES));
    } catch {
      setError('No pudimos preparar una de las imágenes. Prueba con otra.');
    } finally {
      setPreparing(false);
    }
  };

  const submit = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (sinLlave) {
        const st = await obtenerLlave(numeroEmpleado, pin);
        if (st !== 'ok') {
          setPin('');
          setError(st === 'locked' ? 'Cuenta bloqueada por varios intentos fallidos. Intenta más tarde.' : 'El PIN no es correcto.');
          return;
        }
        setSinLlave(false);
      }
      const r = await publishNotice((await leerLlave()) ?? '', title.trim(), body.trim(), kind, priority, images);
      if (r === 'ok') {
        reset();
        onClose();
        onPublished?.();
        showAlert('Aviso publicado', 'Ya está visible para todos los colaboradores.');
      } else if (r === 'no_session') {
        await olvidarLlave();
        setSinLlave(true);
        setError('Confirma tu PIN para publicar.');
      } else if (r === 'not_allowed') {
        setError('Tu puesto no puede publicar avisos.');
      } else if (r === 'bad_image') {
        setError('Una de las imágenes no se pudo guardar. Quítala y vuelve a intentar.');
      } else {
        setError('Revisa el título y el mensaje.');
      }
    } catch {
      setError(images.length ? 'No pudimos publicar el aviso. Si persiste, prueba con menos imágenes.' : 'No pudimos publicar el aviso.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, hoja]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Publicar aviso</Text>

            <Text style={styles.label}>Título</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej. Actualización de puntualidad"
              placeholderTextColor={colors.placeholder}
              maxLength={140}
            />

            <Text style={styles.label}>Mensaje{images.length ? ' (opcional con imagen)' : ''}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={body}
              onChangeText={setBody}
              placeholder="Escribe el comunicado completo"
              placeholderTextColor={colors.placeholder}
              multiline
            />
            <Pressable
              style={[styles.mejorar, (mejorando || body.trim().length < 10) && { opacity: 0.5 }]}
              onPress={mejorar}
              disabled={mejorando || body.trim().length < 10}
              accessibilityRole="button"
              accessibilityLabel="Mejorar redacción con IA"
            >
              {mejorando ? <ActivityIndicator size="small" color={colors.oxBlue} /> : <Icon name="sparkle" size={15} color={colors.oxBlue} />}
              <Text style={styles.mejorarTexto}>{mejorando ? 'Mejorando…' : 'Mejorar redacción'}</Text>
            </Pressable>
            {avisoIa ? <Text style={styles.avisoIa}>{avisoIa}</Text> : null}
            {sugerencia ? (
              <View style={styles.sugerencia}>
                <Text style={styles.sugEtq}>Propuesta con IA · revísala antes de usarla</Text>
                <Text style={styles.sugTitulo}>{sugerencia.titulo}</Text>
                <Text style={styles.sugTexto}>{sugerencia.texto}</Text>
                {sugerencia.cambios ? <Text style={styles.sugCambios}>{sugerencia.cambios}</Text> : null}
                <View style={styles.sugBotones}>
                  <Pressable
                    style={styles.sugUsar}
                    onPress={() => {
                      setTitle(sugerencia.titulo.slice(0, 140));
                      setBody(sugerencia.texto);
                      setSugerencia(null);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.sugUsarTexto}>Usar esta versión</Text>
                  </Pressable>
                  <Pressable style={styles.sugDescartar} onPress={() => setSugerencia(null)} accessibilityRole="button">
                    <Text style={styles.sugDescartarTexto}>Descartar</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Text style={styles.label}>Imágenes (hasta {MAX_IMAGENES})</Text>
            <View style={styles.thumbs}>
              {images.map((img, i) => (
                <View key={img.uri + i} style={styles.thumb}>
                  <Image source={{ uri: `data:${img.mime};base64,${img.data}` }} style={styles.thumbImg} resizeMode="cover" />
                  <Pressable accessibilityRole="button"
                    style={styles.thumbRemove}
                    onPress={() => setImages((xs) => xs.filter((_, j) => j !== i))}
                    accessibilityLabel={`Quitar imagen ${i + 1}`}
                  >
                    <Icon name="close" size={13} color={colors.white} />
                  </Pressable>
                </View>
              ))}
              {images.length < MAX_IMAGENES ? (
                <Pressable style={[styles.thumb, styles.thumbAdd]} onPress={addImages} disabled={preparing} accessibilityRole="button" accessibilityLabel="Agregar imagen">
                  {preparing ? (
                    <ActivityIndicator color={colors.oxRed} />
                  ) : (
                    <>
                      <Icon name="clip" size={20} color={colors.oxRed} />
                      <Text style={styles.thumbAddText}>Agregar</Text>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.label}>Categoría</Text>
            <View style={styles.kindRow}>
              {KINDS.map((k) => (
                <Pressable accessibilityRole="button" key={k} style={[styles.kindChip, kind === k && styles.kindChipActive]} onPress={() => setKind(k)}>
                  <Text style={[styles.kindChipText, kind === k && styles.kindChipTextActive]}>{noticeKindMeta[k].label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.priorityRow} onPress={() => setPriority(!priority)} accessibilityRole="checkbox" accessibilityState={{ checked: priority }}>
              <View style={[styles.checkBox, !priority && styles.checkBoxEmpty]}>{priority ? <Icon name="check" size={14} color={colors.white} /> : null}</View>
              <Text style={styles.priorityText}>Marcar como prioritario</Text>
            </Pressable>

            {sinLlave ? (
              <>
                <Text style={styles.label}>Tu PIN (solo esta vez)</Text>
                <TextInput
                  style={styles.input}
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  autoComplete="off"
                />
              </>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable accessibilityRole="button" style={[styles.publish, !ready && styles.publishDisabled]} onPress={submit} disabled={!ready || submitting}>
              <Text style={styles.publishText}>{submitting ? 'Publicando...' : 'Publicar'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mejorar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#E6EFF8' },
  mejorarTexto: { fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.oxBlue },
  avisoIa: { ...type.caption, color: colors.ink2, marginTop: 6 },
  sugerencia: { marginTop: 10, padding: 12, borderRadius: radii.lg, backgroundColor: '#F2F7FC', borderWidth: 1, borderColor: '#CFE0F2', gap: 6 },
  sugEtq: { fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.oxBlue },
  sugTitulo: { fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.ink },
  sugTexto: { fontFamily: fontFamily.semibold, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  sugCambios: { ...type.caption, color: colors.ink2, fontStyle: 'italic' },
  sugBotones: { flexDirection: 'row', gap: 8, marginTop: 4 },
  sugUsar: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.oxBlue },
  sugUsarTexto: { fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.white },
  sugDescartar: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  sugDescartarTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.ink2 },
  backdrop: { flex: 1, backgroundColor: colors.velo, justifyContent: 'flex-end', padding: 14 },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: radii.pill, backgroundColor: colors.line2, marginBottom: 14 },
  sheet: {
    maxHeight: '90%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.96)',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    ...shadows.sheet,
  },
  sheetTitle: { fontFamily: fontFamily.extrabold, fontSize: 20, color: colors.ink, marginBottom: 6 },
  label: { ...type.label, color: colors.ink, marginBottom: 8, marginTop: 14 },
  input: {
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
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: { width: 92, height: 92, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.field },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(36,26,23,.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbAdd: { alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#F3B8B0', backgroundColor: '#FFF7F5' },
  thumbAddText: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.oxRed },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: { borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  kindChipActive: { backgroundColor: colors.oxRed, borderColor: colors.oxRed },
  kindChipText: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.ink2 },
  kindChipTextActive: { color: colors.white },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  priorityText: { ...type.label, color: colors.ink },
  checkBox: { width: 22, height: 22, borderRadius: 7, backgroundColor: colors.oxRed, alignItems: 'center', justifyContent: 'center' },
  checkBoxEmpty: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.line2 },
  error: { ...type.caption, color: colors.oxRed, marginTop: 10 },
  publish: { minHeight: 52, borderRadius: 16, backgroundColor: colors.oxRed, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  publishDisabled: { opacity: 0.5 },
  publishText: { fontFamily: fontFamily.extrabold, fontSize: 14.5, color: colors.white },

});
