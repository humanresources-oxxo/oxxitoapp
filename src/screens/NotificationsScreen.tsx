// src/screens/NotificationsScreen.tsx
// Internal notices center with read/unread state and detail sheet.
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import {
  Notice,
  NoticeFilter,
  noticeFilters,
  noticeKindMeta,
} from '../data/notices';
import { fetchNotices } from '../services/notices';
import { getJson, setJson, storageKeys } from '../services/appStorage';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';


export function NotificationsScreen() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NoticeFilter>('all');
  const [selected, setSelected] = useState<Notice | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [fetched, readState] = await Promise.all([
        fetchNotices().catch(() => []),
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
      setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

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
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Centro de avisos</Text>
            <Text style={styles.title}>Avisos</Text>
            <Text style={styles.subtitle}>
              {unreadCount > 0 ? `${unreadCount} ${unreadCount === 1 ? 'pendiente' : 'pendientes'} por revisar` : 'Todo está al día'}
            </Text>
          </View>
          <Pressable style={styles.headerAction} onPress={markAllRead}>
            <Icon name="check" size={20} color={colors.oxRed} />
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.summary}>
        <LinearGradient colors={gradients.oxGrad.colors} style={styles.summaryIcon}>
          <Icon name="bell" size={24} color="#fff" />
        </LinearGradient>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>Comunicados internos</Text>
          <Text style={styles.summaryBody}>Prioriza cambios de política, turnos y capacitaciones.</Text>
        </View>
      </View>

      <View style={styles.filters}>
        {noticeFilters.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable
              key={item.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filteredNotices}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <NoticeCard notice={item} onPress={() => openNotice(item)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="bell" size={30} color={colors.ink3} />
            <Text style={styles.emptyText}>
              {loading ? 'Cargando avisos...' : 'No hay avisos para este filtro.'}
            </Text>
          </View>
        }
      />

      <Modal transparent visible={!!selected} animationType="fade" onRequestClose={closeDetail}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDetail} />
          <BlurView intensity={36} tint="light" style={styles.detailSheet}>
            {selected ? <NoticeDetail notice={selected} onClose={closeDetail} /> : null}
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

function NoticeCard({ notice, onPress }: { notice: Notice; onPress: () => void }) {
  const meta = noticeKindMeta[notice.kind];

  return (
    <Pressable style={[styles.card, !notice.read && styles.cardUnread]} onPress={onPress}>
      <View style={styles.cardIconWrap}>
        <LinearGradient colors={gradients[meta.accent].colors} style={styles.cardIcon}>
          <Icon name={meta.icon} size={20} color="#fff" />
        </LinearGradient>
        {!notice.read ? <View style={styles.unreadDot} /> : null}
      </View>

      <View style={styles.cardCopy}>
        <View style={styles.cardTop}>
          <Text style={styles.noticeKind}>{meta.label}</Text>
          <Text style={styles.noticeDate}>{notice.date}</Text>
        </View>
        <Text style={styles.noticeTitle}>{notice.title}</Text>
        <Text style={styles.noticeBody} numberOfLines={2}>
          {notice.body}
        </Text>
      </View>
      <Icon name="chevR" size={18} color={colors.ink3} />
    </Pressable>
  );
}

function NoticeDetail({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const meta = noticeKindMeta[notice.kind];

  return (
    <>
      <View style={styles.sheetHandle} />
      <LinearGradient colors={gradients[meta.accent].colors} style={styles.detailIcon}>
        <Icon name={meta.icon} size={27} color="#fff" />
      </LinearGradient>
      <Text style={styles.detailKind}>{meta.label}</Text>
      <Text style={styles.detailTitle}>{notice.title}</Text>
      <Text style={styles.detailDate}>{notice.date}</Text>
      <Text style={styles.detailBody}>{notice.body}</Text>
      {notice.priority ? (
        <View style={styles.priorityBox}>
          <Icon name="alert" size={18} color={colors.oxRed} />
          <Text style={styles.priorityText}>Aviso prioritario para revisar antes del siguiente turno.</Text>
        </View>
      ) : null}
      <Pressable style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Entendido</Text>
      </Pressable>
    </>
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
  headerCopy: {
    flex: 1,
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
  },
  headerAction: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  summary: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 22,
    padding: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    ...shadows.card,
  },
  summaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    color: colors.ink,
  },
  summaryBody: {
    ...type.bodySm,
    color: colors.ink2,
    marginTop: 4,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  filterChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: colors.oxRed,
    borderColor: colors.oxRed,
  },
  filterText: {
    fontFamily: 'PlusJakartaSans_700Bold',
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
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11.5,
    color: colors.oxRed,
    textTransform: 'uppercase',
  },
  noticeDate: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11.5,
    color: colors.ink3,
  },
  noticeTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 15,
    color: colors.ink,
  },
  noticeBody: {
    ...type.bodySm,
    color: colors.ink2,
    marginTop: 4,
  },
  empty: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    ...type.bodySm,
    color: colors.ink2,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(36,26,23,.22)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  detailSheet: {
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
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    lineHeight: 27,
    color: colors.ink,
    textAlign: 'center',
  },
  detailDate: {
    fontFamily: 'PlusJakartaSans_700Bold',
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
    fontFamily: 'PlusJakartaSans_700Bold',
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
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14.5,
    color: colors.white,
  },
});
