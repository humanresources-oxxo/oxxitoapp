// src/screens/DirectoryScreen.tsx
// Internal contact directory with search and a lightweight call sheet.
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Modal, StyleSheet, Text, TextInput, View, RefreshControl, ScrollView } from 'react-native';
import { Pressable } from '../components/Pressable';
import { LinearGradient } from 'expo-linear-gradient';
import { Encabezado } from '../components/Encabezado';
import { Esqueleto, EstadoVacio } from '../components/Estado';
import { Icon } from '../components/Icon';
import { Contact, fetchContacts } from '../services/directory';
import { colors, gradients, radii, shadows, type, fontFamily, hoja } from '../theme/tokens';


function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function DirectoryScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const refresh = () => {
    setLoading(true);
    setReload((n) => n + 1);
  };
  useEffect(() => {
    let mounted = true;
    fetchContacts()
      .then((rows) => {
        if (!mounted) return;
        setContacts(rows);
        setFailed(false);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [reload]);

  const directoryFilters = useMemo(
    () => ['Todos', ...Array.from(new Set(contacts.map((c) => c.area)))],
    [contacts]
  );

  const filteredContacts = useMemo(() => {
    const clean = normalize(query.trim());
    return contacts.filter((contact) => {
      const matchesFilter = filter === 'Todos' || contact.area === filter;
      const haystack = normalize(
        `${contact.name} ${contact.area} ${contact.role} ${contact.tags.join(' ')}`
      );
      return matchesFilter && (!clean || haystack.includes(clean));
    });
  }, [filter, query, contacts]);

  const callSelected = async () => {
    if (!selected) return;
    const url = `tel:${selected.phone}`;
    try {
      await Linking.openURL(url);
    } finally {
      setSelected(null);
    }
  };

  const whatsappSelected = async () => {
    if (!selected) return;
    const digits = selected.phone.replace(/\D/g, '');
    const url = `https://wa.me/${digits}`;
    try {
      await Linking.openURL(url);
    } finally {
      setSelected(null);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradients.fondo.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Encabezado titulo="Directorio" />

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Icon name="search" size={19} color={colors.ink2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por área o tema..."
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={styles.filters}>
        {directoryFilters.map((item) => {
          const active = item === filter;
          return (
            <Pressable accessibilityRole="button"
              key={item}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ContactCard contact={item} onPress={() => setSelected(item)} />}
        refreshControl={<RefreshControl refreshing={loading && contacts.length > 0} onRefresh={refresh} tintColor={colors.oxRed} colors={[colors.oxRed]} />}
        ListEmptyComponent={
          loading ? (
            <Esqueleto />
          ) : failed ? (
            <EstadoVacio icono="alert" titulo="No pudimos cargar el directorio" texto="Revisa tu conexión e intenta de nuevo." accion={{ texto: 'Reintentar', onPress: refresh }} />
          ) : (
            <EstadoVacio
              icono="search"
              titulo="Sin resultados"
              texto="No encontramos contactos con esa búsqueda."
              accion={query || filter !== 'Todos' ? { texto: 'Ver todos', onPress: () => { setQuery(''); setFilter('Todos'); } } : undefined}
            />
          )
        }
      />

      <Modal transparent visible={!!selected} animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          <View style={[styles.callSheet, hoja]}>
            {selected ? (
              <>
                <View style={styles.sheetHandle} />
                <LinearGradient colors={gradients.oxGrad.colors} style={styles.sheetIcon}>
                  <Icon name="phone" size={26} color={colors.white} />
                </LinearGradient>
                <Text style={styles.sheetTitle}>{selected.name}</Text>
                <Text style={styles.sheetMeta}>{selected.role}</Text>
                <View style={styles.phoneLine}>
                  <Icon name="clock" size={17} color={colors.ink2} />
                  <Text style={styles.phoneLineText}>{selected.schedule}</Text>
                </View>
                <View style={styles.sheetActions}>
                  <Pressable accessibilityRole="button" style={styles.whatsappButton} onPress={whatsappSelected}>
                    <Icon name="whatsapp" size={18} color={colors.white} />
                    <Text style={styles.primaryButtonText}>WhatsApp</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={callSelected}>
                    <Icon name="phone" size={18} color={colors.white} />
                    <Text style={styles.primaryButtonText}>Llamar</Text>
                  </Pressable>
                </View>
                <Pressable accessibilityRole="button" style={styles.cancelRow} onPress={() => setSelected(null)}>
                  <Text style={styles.secondaryButtonText}>Cancelar</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ContactCard({ contact, onPress }: { contact: Contact; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={styles.card} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.contactIcon}>
          <Icon name={contact.urgent ? 'shieldCheck' : 'user'} size={20} color={colors.oxRed} />
        </View>
        <View style={styles.contactCopy}>
          <View style={styles.nameLine}>
            <Text style={styles.contactName}>{contact.name}</Text>
            {contact.urgent ? <Text style={styles.badge}>Prioritario</Text> : null}
          </View>
          <Text style={styles.contactArea}>{contact.area}</Text>
        </View>
        <View style={styles.callIcon}>
          <Icon name="phone" size={18} color={colors.white} />
        </View>
      </View>
      <Text style={styles.contactRole}>{contact.role}</Text>
      <View style={styles.metaRow}>
        <Icon name="clock" size={15} color={colors.ink2} />
        <Text style={styles.metaText}>{contact.schedule}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingBottom: 108,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBox: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    fontFamily: fontFamily.semibold,
    fontSize: 14.5,
    color: colors.ink,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
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
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 15,
    ...shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  contactIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCopy: {
    flex: 1,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  contactName: {
    fontFamily: fontFamily.extrabold,
    fontSize: 16,
    color: colors.ink,
  },
  badge: {
    overflow: 'hidden',
    borderRadius: radii.pill,
    backgroundColor: '#FFE8E3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontFamily: fontFamily.bold,
    fontSize: 12,
    color: colors.oxRed,
  },
  contactArea: {
    fontFamily: fontFamily.bold,
    fontSize: 12.5,
    color: colors.oxRed,
    marginTop: 2,
  },
  callIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.ok,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactRole: {
    ...type.bodySm,
    color: colors.ink2,
    marginTop: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 11,
  },
  metaText: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 12.5,
    color: colors.ink2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.velo,
    justifyContent: 'flex-end',
    padding: 14,
  },
  callSheet: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.9)',
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
  sheetIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
  },
  sheetMeta: {
    ...type.bodySm,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 8,
  },
  phoneLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  phoneLineText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: colors.ink2,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  secondaryButtonText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 14,
    color: colors.ink,
  },
  cancelRow: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    width: '100%',
  },
  whatsappButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: colors.oxRed,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 14,
    color: colors.white,
  },

});
