import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CareerROI, CounselorMessage } from '../types';
import { apiClient } from '../api/client';
import { CareerDetailView } from '../components/CareerDetailView';
import { useTheme } from '../hooks/useTheme';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatCurrency, formatPercent } from '../hooks/useFormatters';
import { getImageUrl } from '../utils/careerImage';

const STORAGE_KEY = 'careerality_counselor_chat';
const COUNSELOR_NAME = 'Career Counselor';
const MIN_TYPING_MS = 900;

const EMPTY_STATE_PROMPTS = [
  'Recommend careers for me',
  'Explain ROI for registered nurses',
  'Compare software developers vs electricians',
  'What are my next steps?',
];

const makeId = () =>
  `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const PulsingDot: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 350, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [delay, opacity]);

  return <Animated.View style={[styles.dot, { backgroundColor: color, opacity }]} />;
};

interface SuggestionCardProps {
  career: CareerROI;
  onPress: (career: CareerROI) => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({ career, onPress }) => {
  const theme = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getImageUrl(career.occupation_code);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <TouchableOpacity
      testID={`suggestion-${career.occupation_code}`}
      style={[styles.suggestionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={() => onPress(career)}
      activeOpacity={0.8}
    >
      {!imageFailed && (
        <Image
          source={{ uri: imageUrl }}
          style={styles.suggestionImage}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      )}
      <View style={styles.suggestionBody}>
        <Text style={[styles.suggestionName, { color: theme.colors.text.primary }]} numberOfLines={2}>
          {career.occupation_name}
        </Text>
        <Text style={[styles.suggestionSalary, { color: theme.colors.text.secondary }]}>
          {formatCurrency(career.annual_median_salary)} median
        </Text>
        <View style={[styles.roiChip, { backgroundColor: theme.colors.primaryLight }]}>
          <Text style={[styles.roiChipText, { color: theme.colors.primary }]}>
            {formatPercent(career.roi_percentage)} ROI
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const CounselorScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages, clearMessages] = useLocalStorage<CounselorMessage[]>(STORAGE_KEY, []);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [detailCareer, setDetailCareer] = useState<CareerROI | null>(null);
  const busyRef = useRef(false);
  const listRef = useRef<FlatList<CounselorMessage>>(null);

  const appendMessage = useCallback(
    (message: CounselorMessage) => {
      setMessages(prev => [...prev, message]);
    },
    [setMessages]
  );

  useEffect(() => {
    if (messages.length > 0 || typing) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages, typing]);

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || busyRef.current) return;
      busyRef.current = true;
      setInput('');

      appendMessage({ id: makeId(), role: 'user', text, createdAt: new Date().toISOString() });
      setTyping(true);

      try {
        const minDelay = new Promise(resolve => setTimeout(resolve, MIN_TYPING_MS));
        const [response] = await Promise.all([apiClient.addCounselorChat(text), minDelay]);
        appendMessage({
          id: makeId(),
          role: 'counselor',
          text: response.reply,
          suggestions: response.suggestions,
          quickReplies: response.quick_replies,
          createdAt: new Date().toISOString(),
        });
      } catch {
        appendMessage({
          id: makeId(),
          role: 'counselor',
          text: 'Sorry — I had trouble reaching the career database just now. Please try again in a moment.',
          createdAt: new Date().toISOString(),
        });
      } finally {
        setTyping(false);
        busyRef.current = false;
      }
    },
    [appendMessage]
  );

  const handleSuggestionPress = useCallback((career: CareerROI) => {
    setDetailCareer(career);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setDetailCareer(null);
  }, []);

  const handleClear = useCallback(() => {
    if (messages.length === 0 || busyRef.current) return;
    clearMessages();
  }, [clearMessages, messages.length]);

  const lastCounselorMessageId = [...messages].reverse().find(m => m.role === 'counselor')?.id;

  const renderMessage = ({ item }: { item: CounselorMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.userRow}>
          <View style={[styles.userBubble, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.userText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    const isLatestCounselorMessage = item.id === lastCounselorMessageId && !typing;
    return (
      <View style={styles.counselorGroup}>
        <View style={styles.counselorRow}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.avatarText}>{COUNSELOR_NAME.charAt(0)}</Text>
          </View>
          <View
            style={[
              styles.counselorBubble,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={styles.counselorName}>{COUNSELOR_NAME}</Text>
            <Text style={[styles.counselorText, { color: theme.colors.text.primary }]}>{item.text}</Text>
          </View>
        </View>

        {item.suggestions && item.suggestions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionsScroll}
            contentContainerStyle={styles.suggestionsContent}
          >
            {item.suggestions.map(suggestion => (
              <SuggestionCard key={suggestion.id} career={suggestion} onPress={handleSuggestionPress} />
            ))}
          </ScrollView>
        )}

        {isLatestCounselorMessage && item.quickReplies && item.quickReplies.length > 0 && (
          <View style={styles.quickRepliesWrap}>
            {item.quickReplies.map(quickReply => (
              <TouchableOpacity
                key={quickReply}
                testID={`quick-reply-${quickReply}`}
                style={[styles.quickReplyChip, { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                onPress={() => send(quickReply)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickReplyText, { color: theme.colors.primary }]}>{quickReply}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (detailCareer) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <CareerDetailView career={detailCareer} onClose={handleCloseDetails} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.toolbar}>
        <TouchableOpacity
          testID="clear-conversation"
          onPress={handleClear}
          disabled={messages.length === 0}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={[
              styles.clearText,
              { color: messages.length === 0 ? theme.colors.text.muted : theme.colors.text.secondary },
            ]}
          >
            Clear conversation
          </Text>
        </TouchableOpacity>
      </View>

      {messages.length === 0 && !typing ? (
        <ScrollView contentContainerStyle={styles.emptyState} testID="counselor-empty-state">
          <View style={[styles.avatarLarge, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.avatarLargeText}>{COUNSELOR_NAME.charAt(0)}</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>Your virtual career counselor</Text>
          <Text style={[styles.emptyBody, { color: theme.colors.text.secondary }]}>
            I combine your swipes with real salary, cost and ROI data to help you plan a career. Ask me to recommend
            careers, explain the ROI of any job, compare two options side by side, or map out your next steps.
          </Text>
          <View style={styles.emptyPromptsWrap}>
            {EMPTY_STATE_PROMPTS.map(prompt => (
              <TouchableOpacity
                key={prompt}
                style={[styles.quickReplyChip, { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                onPress={() => send(prompt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickReplyText, { color: theme.colors.primary }]}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            typing ? (
              <View style={styles.typingRow}>
                <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.avatarText}>{COUNSELOR_NAME.charAt(0)}</Text>
                </View>
                <View
                  style={[
                    styles.counselorBubble,
                    styles.typingBubble,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  {[0, 180, 360].map(delay => (
                    <PulsingDot key={delay} delay={delay} color={theme.colors.text.muted} />
                  ))}
                </View>
              </View>
            ) : null
          }
        />
      )}

      <View
        style={[styles.inputBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <TextInput
          testID="counselor-input"
          style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text.primary, borderColor: theme.colors.border }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about careers, ROI, comparisons…"
          placeholderTextColor={theme.colors.text.muted}
          multiline
          onSubmitEditing={() => send(input)}
        />
        <TouchableOpacity
          testID="counselor-send"
          style={[styles.sendButton, { backgroundColor: theme.colors.primary }, !input.trim() && styles.sendDisabled]}
          onPress={() => send(input)}
          disabled={!input.trim() || typing}
          activeOpacity={0.8}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
  } as ViewStyle,
  clearText: {
    fontSize: 13,
    fontWeight: '500',
  } as TextStyle,
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
  } as ViewStyle,
  emptyState: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  } as ViewStyle,
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  } as ViewStyle,
  avatarLargeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  } as TextStyle,
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  } as TextStyle,
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  } as TextStyle,
  emptyPromptsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  } as ViewStyle,
  quickRepliesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginLeft: 40,
  } as ViewStyle,
  quickReplyChip: {
    borderWidth: 1,
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  } as ViewStyle,
  quickReplyText: {
    fontSize: 13,
    fontWeight: '600',
  } as TextStyle,
  counselorGroup: {
    marginBottom: 16,
  } as ViewStyle,
  counselorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  } as ViewStyle,
  counselorBubble: {
    flexShrink: 1,
    maxWidth: '82%',
    marginLeft: 8,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  } as ViewStyle,
  counselorName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,
  counselorText: {
    fontSize: 15,
    lineHeight: 21,
  } as TextStyle,
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  } as ViewStyle,
  userBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  } as ViewStyle,
  userText: {
    fontSize: 15,
    lineHeight: 21,
    color: '#FFFFFF',
  } as TextStyle,
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  } as ViewStyle,
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  } as TextStyle,
  suggestionsScroll: {
    marginTop: 8,
    marginLeft: 38,
  } as ViewStyle,
  suggestionsContent: {
    paddingRight: 12,
    gap: 10,
  } as ViewStyle,
  suggestionCard: {
    width: 190,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  } as ViewStyle,
  suggestionImage: {
    width: '100%',
    height: 90,
  } as ImageStyle,
  suggestionBody: {
    padding: 10,
  } as ViewStyle,
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    minHeight: 34,
  } as TextStyle,
  suggestionSalary: {
    fontSize: 12,
    marginTop: 4,
  } as TextStyle,
  roiChip: {
    alignSelf: 'flex-start',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  } as ViewStyle,
  roiChipText: {
    fontSize: 11,
    fontWeight: '700',
  } as TextStyle,
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  } as ViewStyle,
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 14,
    paddingHorizontal: 16,
  } as ViewStyle,
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  } as ViewStyle,
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
  } as ViewStyle,
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 15,
    maxHeight: 100,
  } as ViewStyle,
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  } as ViewStyle,
  sendDisabled: {
    opacity: 0.4,
  } as ViewStyle,
  sendIcon: {
    fontSize: 17,
    color: '#FFFFFF',
  } as TextStyle,
});
