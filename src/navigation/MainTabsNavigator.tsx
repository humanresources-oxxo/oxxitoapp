// src/navigation/MainTabsNavigator.tsx
// Lightweight post-login tabs without adding a navigation dependency.
import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '../components/Pressable';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Icon } from '../components/Icon';
import { ActasScreen } from '../screens/ActasScreen';
import { ChatHistoryItem, HomeScreen } from '../screens/HomeScreen';
import { CctScreen } from '../screens/CctScreen';
import { ChatHomeScreen } from '../screens/ChatHomeScreen';
import { CuotaSindicalScreen } from '../screens/CuotaSindicalScreen';
import { DilosScreen } from '../screens/DilosScreen';
import { DirectoryScreen } from '../screens/DirectoryScreen';
import { EstructuraScreen } from '../screens/EstructuraScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { FICHA_URL, ResumenScreen } from '../screens/ResumenScreen';
import { VacacionesScreen } from '../screens/VacacionesScreen';
import { VotacionesScreen } from '../screens/VotacionesScreen';
import { AltasScreen } from '../screens/AltasScreen';
import { getJson, setJson, storageKeys } from '../services/appStorage';
import { puedeLevantarActas, soloSusTiendas, veFicha } from '../services/actas';
import { lookupEmployee, miPerfil } from '../services/auth';
import { fetchNotices } from '../services/notices';
import { contarPendientes } from '../services/votaciones';
import { cargarMiVacacion } from '../services/vacaciones';
import { listarAltas, puedoAprobarAltas } from '../services/altas';
import { alPedirPin, leerLlave } from '../services/sesion';
import { PinUnaVez } from '../components/PinUnaVez';
import { colors, fontFamily, shadows } from '../theme/tokens';

// 'actas', 'vacaciones', 'estructura', 'cuota', 'cct', 'dilos' and 'votaciones' are not in the tab
// bar: they open from Inicio. Actas, Estructura, Cuota sindical, Contratos colectivos,
// Casos DILOS and the team view of Vacaciones are only for some puestos.
type TabKey = 'home' | 'chat' | 'directory' | 'notifications' | 'profile' | 'actas' | 'vacaciones' | 'estructura' | 'cuota' | 'cct' | 'dilos' | 'votaciones' | 'altas' | 'resumen';

type Sesion = { numeroEmpleado?: string; nombre?: string; tienda?: string; plaza?: string; puesto?: string; createdAt?: string };

type TabItem = { key: TabKey; label: string; icon: string };

// Five tabs for everyone. Everything else (Vacaciones, Votaciones, Resumen and
// the management tools) opens from Inicio as a screen of its own, without the
// tab bar and with a back button.
const TABS: TabItem[] = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'chat', label: 'Chat', icon: 'chat' },
  { key: 'notifications', label: 'Avisos', icon: 'bell' },
  { key: 'directory', label: 'Directorio', icon: 'headset' },
  { key: 'profile', label: 'Perfil', icon: 'user' },
];
const esPestana = (k: TabKey) => TABS.some((t) => t.key === k);

export function MainTabsNavigator({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  // A question picked on Inicio, for the chat to ask when it opens.
  const [preguntaChat, setPreguntaChat] = useState<string | undefined>();
  const [vacationDays, setVacationDays] = useState<number | null>(null);

  // Back goes to Inicio instead of leaving the app: the hardware button on
  // Android, the browser's back on the web (one history entry while away
  // from Inicio).
  const ir = (tab: TabKey) => {
    if (tab === 'resumen' && Platform.OS !== 'web') {
      // The ficha is a web page: on the phone it opens in the browser.
      Linking.openURL(FICHA_URL);
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const fuera = !!window.history.state?.conoxxoTab;
      if (tab === 'home') {
        if (fuera) return window.history.back(); // popstate sets the tab
      } else if (fuera) window.history.replaceState({ conoxxoTab: tab }, '');
      else window.history.pushState({ conoxxoTab: tab }, '');
    }
    setActiveTab(tab);
  };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    // A reload keeps the history entry but the app starts on Inicio.
    if (window.history.state?.conoxxoTab) window.history.replaceState(null, '');
    const alVolver = (e: PopStateEvent) => setActiveTab((e.state?.conoxxoTab as TabKey) ?? 'home');
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);
  useEffect(() => {
    if (activeTab === 'home') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveTab('home');
      return true;
    });
    return () => sub.remove();
  }, [activeTab]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [firstName, setFirstName] = useState('');
  const [canUseActas, setCanUseActas] = useState(false);
  const [canSeeFicha, setCanSeeFicha] = useState(false);
  const [onlyOwnStores, setOnlyOwnStores] = useState(false);
  const [unreadNotices, setUnreadNotices] = useState(0);
  const [pendingVotes, setPendingVotes] = useState<number | null>(null);
  const [numeroEmpleado, setNumeroEmpleado] = useState('');

  // Approvers: how many new accounts wait for them (needs the session key).
  const [canApprove, setCanApprove] = useState(false);
  const [pendingAltas, setPendingAltas] = useState(0);
  const refreshAltas = () => {
    leerLlave()
      .then((llave) => (llave ? listarAltas(llave) : null))
      .then((lista) => setPendingAltas(lista?.length ?? 0))
      .catch(() => {});
  };

  // The reglamento, the avisos and the directory are read with the session
  // key (migration 49). A session without one (from before the key, or ended
  // by a PIN change) gets the PIN prompt once; then the open screen reloads.
  const [pedirPin, setPedirPin] = useState(false);
  const [versionSesion, setVersionSesion] = useState(0);
  useEffect(() => alPedirPin(() => setPedirPin(true)), []);

  const refreshPendingVotes = (numero = numeroEmpleado) => {
    if (!numero) return;
    contarPendientes().then(setPendingVotes).catch(() => {});
  };

  const refreshUnreadNotices = () => {
    Promise.all([fetchNotices(false).catch(() => []), getJson<Record<string, boolean>>(storageKeys.noticeReadState, {})]).then(
      ([notices, readState]) => {
        setUnreadNotices(notices.filter((n) => !readState[n.id]).length);
      }
    );
  };

  useEffect(() => {
    let active = true;
    getJson<ChatHistoryItem[]>(storageKeys.chatHistory, []).then((saved) => {
      if (active) setChatHistory(saved);
    });
    getJson<Sesion | null>(storageKeys.session, null).then((session) => {
      if (!active) return;
      // Onboarding marked done but no saved session (storage partly cleared):
      // back to the login instead of an anonymous Inicio.
      if (!session?.numeroEmpleado) {
        onLogout();
        return;
      }
      setFirstName(session?.nombre?.split(' ')[0] ?? '');
      setCanUseActas(puedeLevantarActas(session?.puesto));
      setCanSeeFicha(veFicha(session?.puesto));
      setOnlyOwnStores(soloSusTiendas(session?.puesto));
      setNumeroEmpleado(session?.numeroEmpleado ?? '');
      refreshPendingVotes(session?.numeroEmpleado ?? '');
      cargarMiVacacion(session.numeroEmpleado)
        .then((r) => active && setVacationDays(r.vacacion ? r.vacacion.diasRestantes : null))
        .catch(() => {});
      leerLlave()
        .then((llave) => puedoAprobarAltas(session?.puesto, llave))
        .then((si) => {
          setCanApprove(si);
          if (si) refreshAltas();
        })
        .catch(() => {});
      revalidarSesion(session);
    });
    refreshUnreadNotices();
    return () => {
      active = false;
    };
  }, []);

  // The session is saved at login; check it against the roster on every open
  // (sesion_mi_perfil, with the session key) so a puesto change takes effect
  // and someone removed from the roster is logged out. Network or rate-limit
  // errors keep the saved session.
  const revalidarSesion = (session: Sesion | null) => {
    if (!session?.numeroEmpleado) return;
    miPerfil()
      .then(async (r) => {
        if (!r) {
          // No key, or the server no longer accepts it. Gone from the roster:
          // out. Still there (PIN changed, key from before): PIN once.
          const acceso = await lookupEmployee(session.numeroEmpleado!);
          if (!acceso.exists) return onLogout();
          setPedirPin(true);
          return;
        }
        const nueva = { ...session, nombre: r.nombre ?? session.nombre, tienda: r.tienda, plaza: r.plaza, puesto: r.puesto, createdAt: r.createdAt ?? session.createdAt };
        setJson(storageKeys.session, nueva);
        setFirstName(nueva.nombre?.split(' ')[0] ?? '');
        setCanUseActas(puedeLevantarActas(nueva.puesto));
        setCanSeeFicha(veFicha(nueva.puesto));
        setOnlyOwnStores(soloSusTiendas(nueva.puesto));
        leerLlave()
          .then((llave) => puedoAprobarAltas(nueva.puesto, llave))
          .then(setCanApprove)
          .catch(() => {});
      })
      .catch(() => {});
  };

  // Recompute after leaving Avisos, since that's where read-state changes.
  useEffect(() => {
    if (activeTab !== 'notifications') refreshUnreadNotices();
    if (activeTab === 'home') {
      refreshPendingVotes();
      if (canApprove) refreshAltas();
    }
  }, [activeTab]);

  const saveChatQuestion = (question: string) => {
    const createdAt = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    setChatHistory((current) => {
      const next = [
        { id: String(Date.now()), question, createdAt },
        ...current.filter((item) => item.question !== question),
      ].slice(0, 5);
      setJson(storageKeys.chatHistory, next);
      return next;
    });
    getJson<number>(storageKeys.chatQuestionCount, 0).then((count) => {
      setJson(storageKeys.chatQuestionCount, count + 1);
    });
  };

  const content = useMemo(() => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            onOpenTab={ir}
            onAsk={(pregunta) => {
              setPreguntaChat(pregunta);
              ir('chat');
            }}
            history={chatHistory}
            firstName={firstName}
            unreadNotices={unreadNotices}
            showActas={canUseActas}
            showResumen={canSeeFicha}
            pendingVotes={pendingVotes}
            showAltas={canApprove}
            pendingAltas={pendingAltas}
            vacationDays={vacationDays}
          />
        );
      case 'chat':
        return <ChatHomeScreen onQuestionAsked={saveChatQuestion} preguntaInicial={preguntaChat} onPreguntaUsada={() => setPreguntaChat(undefined)} />;
      case 'directory':
        return <DirectoryScreen />;
      case 'notifications':
        return <NotificationsScreen />;
      case 'profile':
        return <ProfileScreen onLogout={onLogout} />;
      case 'actas':
        return canUseActas ? <ActasScreen onBack={() => ir('home')} /> : null;
      case 'estructura':
        return canUseActas ? <EstructuraScreen onBack={() => ir('home')} soloMisTiendas={onlyOwnStores} /> : null;
      case 'cuota':
        return canUseActas ? <CuotaSindicalScreen onBack={() => ir('home')} soloMisTiendas={onlyOwnStores} /> : null;
      case 'dilos':
        return canUseActas ? <DilosScreen onBack={() => ir('home')} /> : null;
      case 'cct':
        return canUseActas ? <CctScreen onBack={() => ir('home')} /> : null;
      case 'resumen':
        return canSeeFicha ? <ResumenScreen onBack={() => ir('home')} /> : null;
      case 'altas':
        return canApprove ? <AltasScreen onBack={() => ir('home')} onCambio={refreshAltas} /> : null;
      case 'votaciones':
        return <VotacionesScreen onBack={() => ir('home')} onCambio={() => refreshPendingVotes()} />;
      case 'vacaciones':
        return <VacacionesScreen onBack={() => ir('home')} conEquipo={canUseActas} soloMisTiendas={onlyOwnStores} />;
      default:
        return null;
    }
  }, [activeTab, chatHistory, firstName, unreadNotices, canUseActas, canSeeFicha, onlyOwnStores, pendingVotes, numeroEmpleado, canApprove, pendingAltas, preguntaChat, vacationDays]);

  return (
    <View style={styles.shell}>
      <SafeAreaView edges={esPestana(activeTab) ? [] : ['bottom']} style={styles.content}>
        {/* A screen that fails shows a message; switching tabs (key) clears it. */}
        <ErrorBoundary key={`${activeTab}-${versionSesion}`} onReset={() => ir('home')}>
          {content}
        </ErrorBoundary>
      </SafeAreaView>
      {pedirPin && numeroEmpleado ? (
        <PinUnaVez
          numero={numeroEmpleado}
          onCerrar={() => setPedirPin(false)}
          onListo={() => {
            setPedirPin(false);
            setVersionSesion((v) => v + 1);
            refreshUnreadNotices();
            getJson<Sesion | null>(storageKeys.session, null).then(revalidarSesion);
            refreshPendingVotes();
          }}
        />
      ) : null}
      {esPestana(activeTab) ? (
        <SafeAreaView edges={['bottom']} style={styles.tabSafe}>
          <BlurView intensity={38} tint="light" style={styles.tabBar} accessibilityRole="tablist">
            {TABS.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  style={styles.tabButton}
                  onPress={() => ir(tab.key)}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.key === 'notifications' && unreadNotices > 0 ? `Avisos: ${unreadNotices} sin leer` : tab.label}
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                    <Icon name={tab.icon} size={21} color={active ? colors.white : colors.ink2} />
                    {tab.key === 'notifications' && unreadNotices > 0 && !active ? <View style={styles.tabBadge} /> : null}
                  </View>
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </BlurView>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
  },
  tabSafe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  tabBar: {
    minHeight: 72,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.86)',
    backgroundColor: 'rgba(255,255,255,.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 8,
    ...shadows.card,
  },
  tabButton: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabIconWrap: {
    width: 44,
    height: 32,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {
    backgroundColor: colors.oxRed,
  },
  tabBadge: {
    position: 'absolute',
    top: -1,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.oxRed,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  tabLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    letterSpacing: -0.3,
    color: colors.ink2,
  },
  tabLabelActive: {
    color: colors.oxRed,
  },

});





