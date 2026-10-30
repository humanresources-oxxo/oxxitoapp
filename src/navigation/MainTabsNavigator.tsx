// src/navigation/MainTabsNavigator.tsx
// Lightweight post-login tabs without adding a navigation dependency.
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { ActasScreen } from '../screens/ActasScreen';
import { ChatHistoryItem, HomeScreen } from '../screens/HomeScreen';
import { ChatHomeScreen } from '../screens/ChatHomeScreen';
import { DirectoryScreen } from '../screens/DirectoryScreen';
import { EstructuraScreen } from '../screens/EstructuraScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { VacacionesScreen } from '../screens/VacacionesScreen';
import { getJson, setJson, storageKeys } from '../services/appStorage';
import { puedeLevantarActas } from '../services/actas';
import { fetchNotices } from '../services/notices';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';

// 'actas', 'vacaciones' and 'estructura' are not in the tab bar: they open from
// Inicio. Actas, Estructura and the team view of Vacaciones are only for some puestos.
type TabKey = 'home' | 'chat' | 'directory' | 'notifications' | 'profile' | 'dashboard' | 'actas' | 'vacaciones' | 'estructura';

type TabItem = {
  key: TabKey;
  label: string;
  icon: string;
  external?: string;
};

const DASHBOARD_URL = 'https://humanresources-oxxo.github.io/DashboardsOxxo/';

const TABS: TabItem[] = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'chat', label: 'Chat', icon: 'chat' },
  { key: 'directory', label: 'Directorio', icon: 'headset' },
  { key: 'notifications', label: 'Avisos', icon: 'bell' },
  { key: 'dashboard', label: 'Dashboard', icon: 'globe', external: DASHBOARD_URL },
  { key: 'profile', label: 'Perfil', icon: 'user' },
];

export function MainTabsNavigator({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [firstName, setFirstName] = useState('');
  const [canUseActas, setCanUseActas] = useState(false);
  const [unreadNotices, setUnreadNotices] = useState(0);

  const refreshUnreadNotices = () => {
    Promise.all([fetchNotices().catch(() => []), getJson<Record<string, boolean>>(storageKeys.noticeReadState, {})]).then(
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
    getJson<{ nombre?: string; puesto?: string } | null>(storageKeys.session, null).then((session) => {
      if (!active) return;
      setFirstName(session?.nombre?.split(' ')[0] ?? '');
      setCanUseActas(puedeLevantarActas(session?.puesto));
    });
    refreshUnreadNotices();
    return () => {
      active = false;
    };
  }, []);

  // Recompute after leaving Avisos, since that's where read-state changes.
  useEffect(() => {
    if (activeTab !== 'notifications') refreshUnreadNotices();
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
            onOpenTab={setActiveTab}
            history={chatHistory}
            firstName={firstName}
            unreadNotices={unreadNotices}
            showActas={canUseActas}
          />
        );
      case 'chat':
        return <ChatHomeScreen onQuestionAsked={saveChatQuestion} />;
      case 'directory':
        return <DirectoryScreen />;
      case 'notifications':
        return <NotificationsScreen />;
      case 'profile':
        return <ProfileScreen onLogout={onLogout} />;
      case 'actas':
        return canUseActas ? <ActasScreen onBack={() => setActiveTab('home')} /> : null;
      case 'estructura':
        return canUseActas ? <EstructuraScreen onBack={() => setActiveTab('home')} /> : null;
      case 'vacaciones':
        return <VacacionesScreen onBack={() => setActiveTab('home')} conEquipo={canUseActas} />;
      default:
        return null;
    }
  }, [activeTab, chatHistory, firstName, unreadNotices, canUseActas]);

  return (
    <View style={styles.shell}>
      <View style={styles.content}>{content}</View>
      <SafeAreaView edges={['bottom']} style={styles.tabSafe}>
        <BlurView intensity={38} tint="light" style={styles.tabBar}>
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                style={styles.tabButton}
                onPress={() => (tab.external ? Linking.openURL(tab.external) : setActiveTab(tab.key))}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                  <Icon name={tab.icon} size={20} color={active ? colors.white : colors.ink2} />
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
    </View>
  );
}

function PlaceholderScreen({
  icon,
  title,
  eyebrow,
  body,
  items,
}: {
  icon: string;
  title: string;
  eyebrow: string;
  body: string;
  items: string[];
}) {
  return (
    <View style={styles.placeholderScreen}>
      <LinearGradient
        colors={['#FFF7F0', colors.bg, '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView edges={['top']} style={styles.placeholderTop}>
        <View style={styles.placeholderHead}>
          <LinearGradient colors={gradients.oxGrad.colors} style={styles.placeholderIcon}>
            <Icon name={icon} size={26} color="#fff" />
          </LinearGradient>
          <Text style={styles.placeholderEyebrow}>{eyebrow}</Text>
          <Text style={styles.placeholderTitle}>{title}</Text>
          <Text style={styles.placeholderBody}>{body}</Text>
        </View>
      </SafeAreaView>

      <View style={styles.placeholderCards}>
        {items.map((item) => (
          <View style={styles.placeholderCard} key={item}>
            <Icon name="check" size={18} color={colors.ok} />
            <Text style={styles.placeholderCardText}>{item}</Text>
          </View>
        ))}
      </View>
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
    paddingHorizontal: 8,
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
    width: 34,
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
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10.5,
    color: colors.ink2,
  },
  tabLabelActive: {
    color: colors.oxRed,
  },
  placeholderScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingBottom: 108,
  },
  placeholderTop: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  placeholderHead: {
    paddingTop: 18,
  },
  placeholderIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  placeholderEyebrow: {
    ...type.eyebrowSm,
    color: colors.oxRed,
    marginBottom: 8,
  },
  placeholderTitle: {
    ...type.title,
    color: colors.ink,
  },
  placeholderBody: {
    ...type.body,
    color: colors.ink2,
    marginTop: 12,
    maxWidth: 330,
  },
  placeholderCards: {
    paddingHorizontal: 22,
    paddingTop: 22,
    gap: 10,
  },
  placeholderCard: {
    minHeight: 58,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  placeholderCardText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14.5,
    color: colors.ink,
  },
});





