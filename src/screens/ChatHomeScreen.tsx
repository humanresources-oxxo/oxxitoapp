// src/screens/ChatHomeScreen.tsx
// First post-onboarding chat home with mock grounded answers.
import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BearAvatar } from '../components/Bear';
import { Icon } from '../components/Icon';
import {
  ChatChoice,
  ChatMessage,
  ChatSource,
  chatSuggestions,
  getReglamentoItem,
  getSancion,
  initialChatMessages,
  matchQA,
} from '../services/chatQa';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';


export function ChatHomeScreen({ onQuestionAsked }: { onQuestionAsked?: (question: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 760, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 760, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const subtitle = useMemo(() => (typing ? 'Escribiendo respuesta...' : 'Respuestas internas con cita'), [typing]);

  const send = async (text = draft) => {
    const question = text.trim();
    if (!question || typing) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: question,
    };

    setMessages((current) => [...current, userMessage]);
    onQuestionAsked?.(question);
    setDraft('');
    setTyping(true);

    try {
      const result = await matchQA(question);
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: result.answer,
        citation: result.choices ? undefined : result.article,
        title: result.title,
        source: result.choices
          ? undefined
          : {
              article: result.article,
              title: result.title,
              summary: result.summary,
              nextStep: result.nextStep,
              contact: result.contact,
            },
        choices: result.choices,
        choiceKind: result.choiceKind,
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: 'No pude conectar con el reglamento en este momento. Intenta de nuevo en unos segundos.',
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const pickChoice = async (choice: ChatChoice, kind: 'sancion' | 'item' = 'sancion') => {
    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: 'user', text: choice.label }]);
    setTyping(true);
    try {
      let text: string;
      let articleLabel: string;
      let title: string;

      if (kind === 'item') {
        const item = await getReglamentoItem(choice.id);
        text = item ? item.body : 'No encontré el detalle de ese punto.';
        articleLabel = item ? `Artículo ${item.articleNumber}` : 'Reglamento';
        title = 'Reglamento';
      } else {
        const sancion = await getSancion(choice.id);
        text = sancion ? `${sancion.infraccion}: ${sancion.pasos.join(' -> ')}.` : 'No encontré el detalle de esa sanción.';
        articleLabel = sancion ? `Artículo ${sancion.articleNumber}` : 'Artículo 79';
        title = 'Sanciones';
      }

      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text,
          citation: articleLabel,
          title,
          source: {
            article: articleLabel,
            title,
            summary: text,
            nextStep: 'Si necesitas más detalle, contacta a Recursos Humanos o a tu líder directo.',
            contact: { name: 'Recursos Humanos', area: 'Personas' },
          },
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <LinearGradient
        colors={['#FFF7F0', colors.bg, '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <View style={styles.identity}>
            <BearAvatar size={48} />
            <View>
              <Text style={styles.eyebrow}>Conoxxo Plaza Oaxaca</Text>
              <Text style={styles.title}>Chat Home</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          </View>
          <Pressable style={styles.iconButton} accessibilityRole="button">
            <Icon name="bell" size={20} color={colors.ink} />
          </Pressable>
        </View>
      </SafeAreaView>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <Bubble message={item} onOpenSource={setSelectedSource} onPickChoice={pickChoice} />
        )}
        ListFooterComponent={typing ? <TypingBubble pulse={pulse} /> : null}
      />

      <View style={styles.suggestions}>
        {chatSuggestions.map((item) => (
          <Pressable key={item} style={styles.suggestion} onPress={() => send(item)}>
            <Text style={styles.suggestionText}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.composerWrap}>
        <BlurView intensity={35} tint="light" style={styles.composerGlass}>
          <Pressable style={styles.toolButton}>
            <Icon name="clip" size={20} color={colors.ink2} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => send()}
            placeholder="Pregunta sobre el reglamento..."
            placeholderTextColor={colors.ink3}
            returnKeyType="send"
            style={styles.input}
          />
          <Pressable
            style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
            onPress={() => send()}
          >
            <Icon name="send" size={19} color="#fff" />
          </Pressable>
        </BlurView>
      </SafeAreaView>

      <Modal transparent visible={!!selectedSource} animationType="fade" onRequestClose={() => setSelectedSource(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedSource(null)} />
          <BlurView intensity={38} tint="light" style={styles.sourceSheet}>
            {selectedSource ? (
              <SourceDetail source={selectedSource} onClose={() => setSelectedSource(null)} />
            ) : null}
          </BlurView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Bubble({
  message,
  onOpenSource,
  onPickChoice,
}: {
  message: ChatMessage;
  onOpenSource: (source: ChatSource) => void;
  onPickChoice: (choice: ChatChoice, kind: 'sancion' | 'item') => void;
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View style={[styles.bubbleRow, styles.userRow]}>
        <LinearGradient colors={gradients.oxGrad.colors} style={[styles.bubble, styles.userBubble]}>
          <Text style={styles.userText}>{message.text}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.bubbleRow}>
      <View style={styles.avatarMini}>
        <Icon name="chat" size={17} color={colors.oxRed} />
      </View>
      <BlurView intensity={28} tint="light" style={[styles.bubble, styles.assistantBubble]}>
        <Text style={styles.assistantText}>{message.text}</Text>
        {message.choices ? (
          <View style={styles.choiceList}>
            {message.choices.map((choice) => (
              <Pressable
                key={choice.id}
                style={styles.choiceItem}
                onPress={() => onPickChoice(choice, message.choiceKind ?? 'sancion')}
              >
                <Text style={styles.choiceText}>{choice.label}</Text>
                <Icon name="chevR" size={16} color={colors.ink3} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {message.source ? (
          <Pressable style={styles.citation} onPress={() => onOpenSource(message.source!)}>
            <View style={styles.citationIcon}>
              <Icon name="doc" size={14} color={colors.oxRed} />
            </View>
            <View style={styles.citationCopy}>
              <Text style={styles.citationText}>
                {message.source.article} - {message.source.title}
              </Text>
              <Text style={styles.citationHint}>Ver fuente y siguiente paso</Text>
            </View>
            <Icon name="chevR" size={16} color={colors.ink3} />
          </Pressable>
        ) : null}
      </BlurView>
    </View>
  );
}

function SourceDetail({ source, onClose }: { source: ChatSource; onClose: () => void }) {
  return (
    <>
      <View style={styles.sheetHandle} />
      <LinearGradient colors={gradients.oxGrad.colors} style={styles.sourceIcon}>
        <Icon name="doc" size={25} color="#fff" />
      </LinearGradient>
      <Text style={styles.sourceEyebrow}>{source.article}</Text>
      <Text style={styles.sourceTitle}>{source.title}</Text>
      <Text style={styles.sourceBody}>{source.summary}</Text>
      <View style={styles.nextBox}>
        <Icon name="check" size={17} color={colors.oxRed} />
        <Text style={styles.nextText}>{source.nextStep}</Text>
      </View>
      {source.contact ? (
        <View style={styles.contactBox}>
          <View style={styles.contactIcon}>
            <Icon name="headset" size={18} color={colors.oxRed} />
          </View>
          <View style={styles.contactCopy}>
            <Text style={styles.contactLabel}>Contacto sugerido</Text>
            <Text style={styles.contactName}>{source.contact.name}</Text>
            <Text style={styles.contactArea}>{source.contact.area}</Text>
          </View>
        </View>
      ) : null}
      <Pressable style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Entendido</Text>
      </Pressable>
    </>
  );
}
function TypingBubble({ pulse }: { pulse: Animated.Value }) {
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  return (
    <View style={styles.bubbleRow}>
      <View style={styles.avatarMini}>
        <Icon name="chat" size={17} color={colors.oxRed} />
      </View>
      <View style={[styles.bubble, styles.typingBubble]}>
        <Animated.View style={[styles.dot, { opacity }]} />
        <Animated.View style={[styles.dot, { opacity }]} />
        <Animated.View style={[styles.dot, { opacity }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safeTop: {
    backgroundColor: 'rgba(255,255,255,.62)',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  eyebrow: {
    ...type.eyebrowSm,
    color: colors.oxRed,
    marginBottom: 2,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 25,
    lineHeight: 28,
    color: colors.ink,
  },
  subtitle: {
    ...type.caption,
    color: colors.ink2,
    marginTop: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  assistantBubble: {
    padding: 14,
    backgroundColor: 'rgba(255,255,255,.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.9)',
  },
  userBubble: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomRightRadius: 6,
    ...shadows.button,
  },
  assistantText: {
    ...type.bodySm,
    color: colors.ink,
  },
  userText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.white,
  },
  choiceList: {
    marginTop: 10,
    gap: 7,
  },
  choiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  choiceText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.ink,
  },
  citation: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  citationText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: colors.oxRed,
    flex: 1,
  },
  typingBubble: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.oxRed,
  },
  suggestions: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestion: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  suggestionText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: colors.ink,
  },
  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 96,
  },
  composerGlass: {
    minHeight: 58,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.85)',
    backgroundColor: 'rgba(255,255,255,.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...shadows.card,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.field,
  },
  input: {
    flex: 1,
    minHeight: 40,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14.5,
    color: colors.ink,
    paddingHorizontal: 2,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oxRed,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  citationIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  citationCopy: {
    flex: 1,
  },
  citationHint: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11.5,
    color: colors.ink3,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(36,26,23,.24)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  sourceSheet: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.94)',
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
  sourceIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sourceEyebrow: {
    ...type.eyebrowSm,
    color: colors.oxRed,
    marginBottom: 8,
  },
  sourceTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    lineHeight: 27,
    color: colors.ink,
    textAlign: 'center',
  },
  sourceBody: {
    ...type.body,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 12,
  },
  nextBox: {
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
  nextText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.ink,
  },
  contactBox: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 13,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  contactLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11.5,
    color: colors.ink3,
    textTransform: 'uppercase',
  },
  contactName: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14.5,
    color: colors.ink,
    marginTop: 3,
  },
  contactArea: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12.5,
    color: colors.oxRed,
    marginTop: 2,
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






