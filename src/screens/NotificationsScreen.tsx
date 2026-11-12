// src/screens/NotificationsScreen.tsx
// Internal notices center with read/unread state and detail sheet. Avisos can
// carry up to 3 images (shown in the card, the detail and full screen). RH and
// Gerente de plaza also publish ("Nuevo aviso") and delete them here.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, ScrollView, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { Pressable } from '../components/Pressable';
import { LinearGradient } from 'expo-linear-gradient';
import { AvisoComposer } from '../components/AvisoComposer';
import { BotonEncabezado, Encabezado } from '../components/Encabezado';
import { Esqueleto, EstadoVacio } from '../components/Estado';
import { Fondo } from '../components/Fondo';
import { Icon } from '../components/Icon';
import { PinUnaVez } from '../components/PinUnaVez';
import {
  Notice,
  NoticeFilter,
  noticeFilters,
  NoticeImage,
  noticeKindMeta,
} from '../data/notices';
import { cargarImagenAviso, deleteNotice, fetchNotices } from '../services/notices';
import { leerLlave, olvidarLlave, puedePublicar } from '../services/sesion';
import { confirmAlert, showAlert } from '../utils/alert';
import { getJson, setJson, storageKeys } from '../services/appStorage';
import { acento, colors, gradients, radii, shadows, type, fontFamily, hoja } from '../theme/tokens';


export function NotificationsScreen() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<NoticeFilter>('all');
  const [selected, setSelected] = useState<Notice | null>(null);
  const [viewer, setViewer] = useState<NoticeImage | null>(null);
  const [composer, setComposer] = useState(false);
  const [numero, setNumero] = useState('');
  const [canPublish, setCanPublish] = useState(false);
  const [reload, setReload] = useState(0);
  // Aviso to delete once the PIN is confirmed (session without a key).
  const [pinFor, setPinFor] = useState<Notice | null>(null);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    getJson<{ numeroEmpleado?: string; puesto?: string } | null>(storageKeys.session, null).then((s) => {
      setNumero(s?.numeroEmpleado ?? '');
      setCanPublish(puedePublicar(s?.puesto));
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      let fallo = false;
      const [fetched, readState] = await Promise.all([
        fetchNotices().catch(() => {
          fallo = true;
          return [] as Notice[];
        }),
        getJson<Record<string, boolean>>(storageKeys.noticeReadState, {}),
      ]);
      if (!mounted) return;

      setNotices(
        fetched.map((notice) =>
          Object.prototype.hasOwnProperty.call(readState, notice.id)
            ? { ...notice, read: readState[notice.id] }
            : notice
        )
      );
      setFailed(fallo);
      setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, [reload]);

  const saveNotices = (nextNotices: Notice[]) => {
    const readState = nextNotices.reduce<Record<string, boolean>>((acc, notice) => {
      acc[notice.id] = notice.read;
      return acc;
    }, {});

    setJson(storageKeys.noticeReadState, readState);
  };

  const unreadCount = notices.filter((notice) => !notice.read).length;

  const filteredNotices = useMemo(() => {
    if (filter === 'all') return notices;
    if (filter === 'unread') return notices.filter((notice) => !notice.read);
    return notices.filter((notice) => notice.kind === filter);
  }, [filter, notices]);

  const openNotice = (notice: Notice) => {
    setSelected(notice);
    setNotices((current) => {
      const next = current.map((item) => (item.id === notice.id ? { ...item, read: true } : item));
      saveNotices(next);
      return next;
    });
  };

  const markAllRead = () => {
    setNotices((current) => {
      const next = current.map((notice) => ({ ...notice, read: true }));
      saveNotices(next);
      return next;
    });
  };

  const closeDetail = () => {
    setSelected(null);
  };

  const removeNotice = async (notice: Notice, confirmed = false) => {
    if (!confirmed && !(await confirmAlert('Borrar aviso', `"${notice.title}" se borra para todos, con sus imágenes.`, 'Borrar'))) return;
    const llave = await leerLlave();
    const r = llave ? await deleteNotice(llave, notice.id).catch(() => 'error') : 'no_session';
    if (r === 'ok') {
      setSelected(null);
      refresh();
    } else if (r === 'no_session') {
      await olvidarLlave();
      setPinFor(notice);
    } else {
      showAlert('No se pudo borrar', r === 'not_allowed' ? 'Tu puesto no puede borrar avisos.' : 'Revisa tu conexión e intenta de nuevo.');
    }
  };

  return (
    <View style={styles.screen}>
      <Fondo />

      <Encabezado titulo="Avisos" nota={unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo está al día'}>
        {unreadCount > 0 ? <BotonEncabezado icono="check" texto="Leídos" etiqueta="Marcar todos como leídos" onPress={markAllRead} /> : null}
        {canPublish ? <BotonEncabezado icono="edit" texto="Nuevo" etiqueta="Nuevo aviso" principal onPress={() => setComposer(true)} /> : null}
      </Encabezado>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersWrap} contentContainerStyle={styles.filters}>
        {noticeFilters.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable accessibilityRole="button"
              key={item.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={filteredNotices}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <NoticeCard notice={item} onPress={() => openNotice(item)} />}
        refreshControl={<RefreshControl refreshing={loading && notices.length > 0} onRefresh={() => { setLoading(true); refresh(); }} tintColor={colors.oxRed} colors={[colors.oxRed]} />}
        ListEmptyComponent={
          loading ? (
            <Esqueleto />
          ) : failed ? (
            <EstadoVacio icono="alert" titulo="No pudimos cargar los avisos" texto="Revisa tu conexión e intenta de nuevo." accion={{ texto: 'Reintentar', onPress: () => { setLoading(true); refresh(); } }} />
          ) : (
            <EstadoVacio titulo={filter === 'all' ? 'Aún no hay avisos' : 'Nada en este filtro'} texto={filter === 'all' ? 'Cuando RH publique un comunicado lo verás aquí.' : undefined} accion={filter === 'all' ? undefined : { texto: 'Ver todos', onPress: () => setFilter('all') }} />
          )
        }
      />

      <Modal transparent visible={!!selected} animationType="fade" onRequestClose={closeDetail}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={closeDetail} />
          <View style={[styles.detailSheet, hoja]}>
            {selected ? (
              <NoticeDetail
                notice={selected}
                onClose={closeDetail}
                onImage={setViewer}
                onDelete={canPublish ? () => removeNotice(selected) : undefined}
              />
            ) : null}
          </View>
        </View>
        {viewer ? <ImageViewer image={viewer} onClose={() => setViewer(null)} /> : null}
      </Modal>

      {pinFor ? (
        <PinUnaVez
          numero={numero}
          onCerrar={() => setPinFor(null)}
          onListo={() => {
            const n = pinFor;
            setPinFor(null);
            removeNotice(n, true);
          }}
        />
      ) : null}

      <AvisoComposer visible={composer} numeroEmpleado={numero} onClose={() => setComposer(false)} onPublished={refresh} />
    </View>
  );
}

function NoticeCard({ notice, onPress }: { notice: Notice; onPress: () => void }) {
  const meta = noticeKindMeta[notice.kind];

  return (
    <Pressable accessibilityRole="button" style={[styles.card, !notice.read && styles.cardUnread]} onPress={onPress}>
      <View style={styles.cardIconWrap}>
        <LinearGradient colors={gradients[meta.accent].colors} style={styles.cardIcon}>
          <Icon name={meta.icon} size={20} color={colors.white} />
        </LinearGradient>
        {!notice.read ? <View style={styles.unreadDot} /> : null}
      </View>

      <View style={styles.cardCopy}>
        <View style={styles.cardTop}>
          <Text style={[styles.noticeKind, { color: acento[meta.accent] }]}>{meta.label}</Text>
          <Text style={styles.noticeDate}>{notice.date}</Text>
        </View>
        <Text style={styles.noticeTitle}>{notice.title}</Text>
        {notice.body ? (
          <Text style={styles.noticeBody} numberOfLines={2}>
            {notice.body}
          </Text>
        ) : null}
        {notice.images?.length ? (
          <View>
            <NoticeImageView image={notice.images[0]} style={styles.cardImage} />
            {notice.images.length > 1 ? (
              <View style={styles.moreImages}>
                <Text style={styles.moreImagesText}>+{notice.images.length - 1}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <Icon name="chevR" size={18} color={colors.ink3} />
    </Pressable>
  );
}

// One aviso image, loaded on demand (services/notices.ts keeps it in memory).
function NoticeImageView({
  image,
  style,
  resizeMode = 'cover',
  onPress,
}: {
  image: NoticeImage;
  style: any;
  resizeMode?: 'cover' | 'contain';
  onPress?: () => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    cargarImagenAviso(image.id)
      .then((u) => active && setUri(u))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [image.id]);
  return (
    <Pressable style={[styles.imageBox, style]} onPress={onPress} disabled={!onPress || !uri} accessibilityRole={onPress ? 'imagebutton' : 'image'}>
      {uri ? (
        <Image source={{ uri }} style={styles.imageFill} resizeMode={resizeMode} accessibilityLabel="Imagen del aviso" />
      ) : failed ? (
        <Icon name="alert" size={20} color={colors.ink3} />
      ) : (
        <ActivityIndicator color={colors.oxRed} />
      )}
    </Pressable>
  );
}

function ImageViewer({ image, onClose }: { image: NoticeImage; onClose: () => void }) {
  return (
    <View style={styles.viewer}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={onClose} />
      <NoticeImageView image={image} style={styles.viewerImage} resizeMode="contain" />
      <Pressable accessibilityRole="button" style={styles.viewerClose} onPress={onClose} accessibilityLabel="Cerrar imagen">
        <Icon name="close" size={20} color={colors.white} />
      </Pressable>
    </View>
  );
}

function NoticeDetail({
  notice,
  onClose,
  onImage,
  onDelete,
}: {
  notice: Notice;
  onClose: () => void;
  onImage: (image: NoticeImage) => void;
  onDelete?: () => void;
}) {
  const meta = noticeKindMeta[notice.kind];

  return (
    <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={styles.sheetHandle} />
      <LinearGradient colors={gradients[meta.accent].colors} style={styles.detailIcon}>
        <Icon name={meta.icon} size={27} color={colors.white} />
      </LinearGradient>
      <Text style={[styles.detailKind, { color: acento[meta.accent] }]}>{meta.label}</Text>
      <Text style={styles.detailTitle}>{notice.title}</Text>
      <Text style={styles.detailDate}>{notice.date}</Text>
      {notice.body ? <Text style={styles.detailBody}>{notice.body}</Text> : null}
      {notice.images?.map((img) => (
        <NoticeImageView
          key={img.id}
          image={img}
          style={[styles.detailImage, { aspectRatio: img.width / img.height }]}
          onPress={() => onImage(img)}
        />
      ))}
      {notice.priority ? (
        <View style={styles.priorityBox}>
          <Icon name="alert" size={18} color={colors.oxRed} />
          <Text style={styles.priorityText}>Aviso prioritario para revisar antes del siguiente turno.</Text>
        </View>
      ) : null}
      <Pressable accessibilityRole="button" style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Entendido</Text>
      </Pressable>
      {onDelete ? (
        <Pressable style={styles.deleteButton} onPress={onDelete} accessibilityRole="button">
          <Icon name="close" size={15} color={colors.oxRed} />
          <Text style={styles.deleteButtonText}>Borrar aviso</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardImage: { height: 150, borderRadius: 14, marginTop: 10 },
  moreImages: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(36,26,23,.72)',
  },
  moreImagesText: { fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.white },
  imageBox: { overflow: 'hidden', backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' },
  imageFill: { width: '100%', height: '100%' },
  detailImage: { alignSelf: 'stretch', borderRadius: 16, marginTop: 14, maxHeight: 520 },
  viewer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(10,8,7,.94)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  viewerImage: { width: '100%', height: '82%', backgroundColor: 'transparent' },
  viewerClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingVertical: 8, paddingHorizontal: 14 },
  deleteButtonText: { fontFamily: fontFamily.bold, fontSize: 13.5, color: colors.oxRed },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingBottom: 108,
  },
  filtersWrap: { flexGrow: 0, flexShrink: 0 },
  filters: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  filterChip: {
    borderRadius: radii.pill,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: colors.oxRed,
    borderColor: colors.oxRed,
  },
  filterText: {
    fontFamily: fontFamily.bold,
    fontSize: 12.5,
    color: colors.ink2,
  },
  filterTextActive: {
    color: colors.white,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  card: {
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255,255,255,.84)',
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardUnread: {
    backgroundColor: colors.white,
    borderColor: '#FFD2C4',
    ...shadows.card,
  },
  cardIconWrap: {
    width: 46,
    height: 46,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.oxRed,
    borderWidth: 2,
    borderColor: colors.white,
  },
  cardCopy: {
    flex: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  noticeKind: {
    fontFamily: fontFamily.extrabold,
    fontSize: 12,
    color: colors.oxRed,
    textTransform: 'uppercase',
  },
  noticeDate: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.ink3,
  },
  noticeTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: 15,
    color: colors.ink,
  },
  noticeBody: {
    ...type.bodySm,
    color: colors.ink2,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.velo,
    justifyContent: 'flex-end',
    padding: 14,
  },
  detailSheet: {
    maxHeight: '88%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.92)',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    alignItems: 'center',
    ...shadows.sheet,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.line2,
    marginBottom: 18,
  },
  detailIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  detailKind: {
    ...type.eyebrowSm,
    color: colors.oxRed,
    marginBottom: 8,
  },
  detailTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: 22,
    lineHeight: 27,
    color: colors.ink,
    textAlign: 'center',
  },
  detailDate: {
    fontFamily: fontFamily.bold,
    fontSize: 12.5,
    color: colors.ink3,
    marginTop: 8,
  },
  detailBody: {
    ...type.body,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 14,
  },
  priorityBox: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#FFF0EC',
    borderWidth: 1,
    borderColor: '#FFD2C4',
    padding: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priorityText: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.ink,
  },
  closeButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: colors.oxRed,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  closeButtonText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 14.5,
    color: colors.white,
  },

});
