import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  ChevronDown,
  ChevronRight,
  History,
  MessageCircleMore,
  Mic,
  Square,
  PiggyBank,
  Plus,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../../constants/Colors';
import CategoryIcon from '../../components/CategoryIcon';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { savingsService } from '../../services/savings';
import { chatbotService } from '../../services/chatbot';
import type {
  ChatbotConversation,
  ChatMessage,
  ChatTransactionDraft,
} from '../../types/chatbot';
import type { SavingsAssistantContext } from '../../types/savings';
import { getUserFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/format';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import ChatPlanSuggestions from '../../components/ChatPlanSuggestions';

const screenAccent = '#A95514';

const baseSuggestedQuestions = [
  'Gợi ý 3 kế hoạch tài chính',
  'Tóm tắt chi tiêu tháng này',
  'Tôi chi nhiều nhất vào đâu?',
  'Kiểm tra ngân sách của tôi',
  'Dự báo thu chi 4 tháng tới',
];

const guidedPlans = [
  {
    title: 'Giảm chi',
    description: 'Chọn khoản có thể giảm và giới hạn mỗi tháng',
    question: 'Lập kế hoạch giảm chi',
  },
  {
    title: 'Tiết kiệm cho mục tiêu',
    description: 'Chia số tiền còn thiếu thành các kỳ góp',
    question: 'Lập kế hoạch tiết kiệm',
  },
  {
    title: 'Quỹ dự phòng',
    description: 'Xem khoản có thể để riêng cho việc phát sinh',
    question: 'Lập quỹ dự phòng',
  },
];

const MESSAGE_PAGE_SIZE = 30;
const CONVERSATION_PAGE_SIZE = 20;

const chatDateKey = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatChatDate = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (chatDateKey(value) === chatDateKey(today.toISOString())) return 'Hôm nay';
  if (chatDateKey(value) === chatDateKey(yesterday.toISOString())) {
    return 'Hôm qua';
  }
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatChatTime = (value?: string) =>
  (value ? new Date(value) : new Date()).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

type ChatbotScreenProps = {
  onScanReceipt?: () => void | Promise<void>;
  onCreateTransaction?: (draft: ChatTransactionDraft) => void;
};

const ChatbotScreen = ({
  onScanReceipt,
  onCreateTransaction,
}: ChatbotScreenProps) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { token } = useAuth();
  const [draft, setDraft] = useState('');
  const [planMonths, setPlanMonths] = useState(3);
  const voice = useVoiceInput(setDraft);

  useEffect(
    () => navigation.addListener('blur', voice.cancel),
    [navigation, voice.cancel],
  );
  const [savingsContext, setSavingsContext] =
    useState<SavingsAssistantContext | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ChatbotConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRetry, setHistoryRetry] = useState(0);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [oldestMessageCursor, setOldestMessageCursor] = useState<number | null>(
    null,
  );
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] =
    useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [conversationCursor, setConversationCursor] = useState<string | null>(
    null,
  );
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState(
    baseSuggestedQuestions,
  );
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const chatScrollRef = useRef<FlatList<ChatMessage>>(null);
  const shouldScrollToEndRef = useRef(true);
  const activeConversationIdRef = useRef<number | null>(null);
  const isLoadingOlderMessagesRef = useRef(false);
  const isLoadingMoreConversationsRef = useRef(false);
  const conversationRevision = useRef(0);
  const historyLoadingRef = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setSavingsContext(null);
      return;
    }
    savingsService
      .getContext(token)
      .then(result => {
        if (active) setSavingsContext(result);
      })
      .catch(() => {
        if (active) setSavingsContext(null);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    let active = true;
    const revision = ++conversationRevision.current;
    sendingRef.current = false;
    setIsSending(false);
    setHistoryError(null);
    if (!token) {
      setMessages([]);
      setConversations([]);
      setActiveConversationId(null);
      setHasMoreMessages(false);
      setOldestMessageCursor(null);
      setHasMoreConversations(false);
      setConversationCursor(null);
      setSuggestedQuestions(baseSuggestedQuestions);
      return () => {
        active = false;
      };
    }

    historyLoadingRef.current = true;
    setIsHistoryLoading(true);
    setIsSuggestionsLoading(true);
    chatbotService
      .conversations(token, CONVERSATION_PAGE_SIZE)
      .then(async result => {
        if (!active || revision !== conversationRevision.current) return;
        setConversations(result.conversations);
        setHasMoreConversations(result.has_more);
        setConversationCursor(result.next_cursor);
        const latestConversation = result.conversations[0];
        if (!latestConversation) {
          setActiveConversationId(null);
          setMessages([]);
          setHasMoreMessages(false);
          setOldestMessageCursor(null);
          return;
        }
        setActiveConversationId(latestConversation.id);
        activeConversationIdRef.current = latestConversation.id;
        const history = await chatbotService.conversationHistory(
          token,
          latestConversation.id,
          MESSAGE_PAGE_SIZE,
        );
        if (!active || revision !== conversationRevision.current) return;
        shouldScrollToEndRef.current = true;
        setMessages(history.messages);
        setHasMoreMessages(history.has_more);
        setOldestMessageCursor(history.next_cursor);
      })
      .catch(error => {
        if (active && revision === conversationRevision.current) {
          setHistoryError(
            getUserFriendlyErrorMessage(
              error,
              'Chưa tải được lịch sử trò chuyện.',
            ),
          );
          setActiveConversationId(null);
          activeConversationIdRef.current = null;
          setMessages([]);
          setHasMoreMessages(false);
          setOldestMessageCursor(null);
        }
      })
      .finally(() => {
        if (active && revision === conversationRevision.current) {
          historyLoadingRef.current = false;
          setIsHistoryLoading(false);
        }
      });
    chatbotService
      .suggestions(token)
      .then(result => {
        if (active && result.suggestions.length) {
          setSuggestedQuestions(result.suggestions);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsSuggestionsLoading(false);
      });

    return () => {
      active = false;
      conversationRevision.current += 1;
    };
  }, [token, historyRetry]);

  const handleScanReceipt = () => {
    if (onScanReceipt) {
      Promise.resolve(onScanReceipt()).catch(() => undefined);
      return;
    }
    Alert.alert(
      'Mở form giao dịch',
      'Hãy mở form thêm giao dịch để chọn và quét ảnh hóa đơn.',
    );
  };

  const handleSelectConversation = async (conversationId: number) => {
    if (sendingRef.current) return;
    voice.cancel();
    if (!token) return;
    setIsHistoryVisible(false);
    if (conversationId === activeConversationId && !historyLoadingRef.current)
      return;
    const revision = ++conversationRevision.current;
    historyLoadingRef.current = true;
    setIsHistoryLoading(true);
    try {
      const result = await chatbotService.conversationHistory(
        token,
        conversationId,
        MESSAGE_PAGE_SIZE,
      );
      if (revision !== conversationRevision.current) return;
      setActiveConversationId(conversationId);
      activeConversationIdRef.current = conversationId;
      setHistoryError(null);
      shouldScrollToEndRef.current = true;
      setMessages(result.messages);
      setHasMoreMessages(result.has_more);
      setOldestMessageCursor(result.next_cursor);
      setShowScrollToBottom(false);
    } catch (error) {
      if (revision !== conversationRevision.current) return;
      Alert.alert(
        'Không mở được lịch sử',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      if (revision === conversationRevision.current) {
        historyLoadingRef.current = false;
        setIsHistoryLoading(false);
      }
    }
  };

  const handleNewConversation = () => {
    if (sendingRef.current) return;
    conversationRevision.current += 1;
    historyLoadingRef.current = false;
    setIsHistoryLoading(false);
    setHistoryError(null);
    voice.cancel();
    setIsHistoryVisible(false);
    setActiveConversationId(null);
    activeConversationIdRef.current = null;
    setMessages([]);
    setHasMoreMessages(false);
    setOldestMessageCursor(null);
    setDraft('');
    setShowScrollToBottom(false);
    shouldScrollToEndRef.current = true;
  };

  const handleLoadOlderMessages = async () => {
    const revision = conversationRevision.current;
    const conversationId = activeConversationIdRef.current;
    if (
      !token ||
      !conversationId ||
      !hasMoreMessages ||
      !oldestMessageCursor ||
      isHistoryLoading ||
      isLoadingOlderMessagesRef.current
    ) {
      return;
    }

    isLoadingOlderMessagesRef.current = true;
    setIsLoadingOlderMessages(true);
    shouldScrollToEndRef.current = false;
    try {
      const result = await chatbotService.conversationHistory(
        token,
        conversationId,
        MESSAGE_PAGE_SIZE,
        oldestMessageCursor,
      );
      if (
        revision !== conversationRevision.current ||
        activeConversationIdRef.current !== conversationId
      )
        return;
      setMessages(current => {
        const existingIds = new Set(current.map(message => String(message.id)));
        const olderMessages = result.messages.filter(
          message => !existingIds.has(String(message.id)),
        );
        return [...olderMessages, ...current];
      });
      setHasMoreMessages(result.has_more);
      setOldestMessageCursor(result.next_cursor);
    } catch (error) {
      if (revision !== conversationRevision.current) return;
      Alert.alert(
        'Không tải được tin nhắn cũ',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      isLoadingOlderMessagesRef.current = false;
      setIsLoadingOlderMessages(false);
    }
  };

  const handleLoadMoreConversations = async () => {
    if (
      !token ||
      !hasMoreConversations ||
      !conversationCursor ||
      isLoadingMoreConversationsRef.current
    ) {
      return;
    }

    isLoadingMoreConversationsRef.current = true;
    setIsLoadingMoreConversations(true);
    try {
      const result = await chatbotService.conversations(
        token,
        CONVERSATION_PAGE_SIZE,
        conversationCursor,
      );
      setConversations(current => {
        const existingIds = new Set(
          current.map(conversation => conversation.id),
        );
        return [
          ...current,
          ...result.conversations.filter(
            conversation => !existingIds.has(conversation.id),
          ),
        ];
      });
      setHasMoreConversations(result.has_more);
      setConversationCursor(result.next_cursor);
    } catch (error) {
      Alert.alert(
        'Không tải được lịch sử',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      isLoadingMoreConversationsRef.current = false;
      setIsLoadingMoreConversations(false);
    }
  };

  const handleSend = async (suggestedQuestion?: string) => {
    const isSuggestedQuestion = suggestedQuestion !== undefined;
    const question = (suggestedQuestion ?? draft).trim();
    if (
      !token ||
      !question ||
      sendingRef.current ||
      historyLoadingRef.current ||
      historyError ||
      voice.isBusy
    ) {
      return;
    }
    sendingRef.current = true;
    const revision = conversationRevision.current;

    const optimisticId = `pending-${Date.now()}`;
    const optimisticUserMessage: ChatMessage = {
      id: optimisticId,
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    };
    const nextMessages: ChatMessage[] = [...messages, optimisticUserMessage];
    shouldScrollToEndRef.current = true;
    setMessages(nextMessages);
    if (!isSuggestedQuestion) setDraft('');
    setIsSending(true);

    try {
      const response = await chatbotService.send(
        token,
        question,
        activeConversationId,
      );
      if (revision !== conversationRevision.current) return;
      setActiveConversationId(response.conversation_id);
      activeConversationIdRef.current = response.conversation_id;
      shouldScrollToEndRef.current = true;
      setMessages(current => [
        ...current.filter(message => message.id !== optimisticId),
        response.user_message,
        response.assistant_message,
      ]);
      if (response.action?.type === 'SCAN_RECEIPT') {
        handleScanReceipt();
      } else if (response.action?.type === 'CREATE_TRANSACTION') {
        if (onCreateTransaction) onCreateTransaction(response.action.draft);
        else
          Alert.alert(
            'Thêm giao dịch',
            'Mở màn hình chính để kiểm tra và lưu giao dịch.',
          );
      }
      if (!activeConversationId) {
        setHasMoreMessages(false);
        setOldestMessageCursor(null);
      }
      chatbotService
        .conversations(token, CONVERSATION_PAGE_SIZE)
        .then(result => {
          if (revision !== conversationRevision.current) return;
          setConversations(result.conversations);
          setHasMoreConversations(result.has_more);
          setConversationCursor(result.next_cursor);
        })
        .catch(() => undefined);
    } catch (error) {
      if (revision !== conversationRevision.current) return;
      setMessages(current =>
        current.filter(message => message.id !== optimisticId),
      );
      if (!isSuggestedQuestion) setDraft(question);
      Alert.alert(
        'Chatbot chưa trả lời được',
        getUserFriendlyErrorMessage(error, 'Vui lòng thử lại sau.'),
      );
    } finally {
      if (revision === conversationRevision.current) {
        sendingRef.current = false;
        setIsSending(false);
      }
    }
  };

  const conversationGroups = conversations.reduce<
    Array<{ label: string; items: ChatbotConversation[] }>
  >((groups, conversation) => {
    const label = formatChatDate(conversation.updated_at);
    const currentGroup = groups.at(-1);
    if (currentGroup?.label === label) {
      currentGroup.items.push(conversation);
    } else {
      groups.push({ label, items: [conversation] });
    }
    return groups;
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.assistantMark}>
          <MessageCircleMore size={24} color="#A95514" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Trợ lý tài chính</Text>
          <Text style={styles.subtitle}>
            Hỏi về chi tiêu · Câu trả lời có hỗ trợ AI
          </Text>
        </View>
        <TouchableOpacity
          style={styles.statusBadge}
          activeOpacity={0.82}
          accessibilityLabel="Mở lịch sử trò chuyện"
          onPress={() => setIsHistoryVisible(true)}
        >
          <History size={16} color={screenAccent} />
          <Text style={styles.statusText}>Lịch sử</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.contextBar}
        activeOpacity={0.84}
        onPress={() => navigation.navigate('FinancialPlan')}
      >
        <View style={styles.contextIcon}>
          <PiggyBank size={19} color={screenAccent} />
        </View>
        <View style={styles.contextHeaderCopy}>
          <Text style={styles.contextTitle}>Kế hoạch của bạn</Text>
          <Text style={styles.contextSubtitle} numberOfLines={1}>
            {savingsContext?.active_goal_count
              ? `${savingsContext.active_goal_count} mục tiêu tiết kiệm đang hoạt động`
              : 'Xem dự báo thu chi và lịch góp tiết kiệm'}
          </Text>
        </View>
        <ChevronRight size={18} color={screenAccent} />
      </TouchableOpacity>

      <View style={styles.chatPanel}>
        <FlatList
          ref={chatScrollRef}
          data={messages}
          style={styles.chatFrame}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chatContent}
          keyExtractor={(message, index) =>
            String(message.id ?? `${message.role}-${index}`)
          }
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          ListHeaderComponent={
            <>
              <ChatPlanSuggestions
                token={token}
                months={planMonths}
                onSelect={reductionFactor =>
                  navigation.navigate('FinancialPlan', {
                    months: planMonths,
                    reductionFactor,
                  })
                }
              />
              {isLoadingOlderMessages ? (
                <View style={styles.olderMessagesLoading}>
                  <ActivityIndicator size="small" color={screenAccent} />
                  <Text style={styles.typingText}>Đang tải tin nhắn cũ…</Text>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            isHistoryLoading ? (
              <View style={styles.historyLoading}>
                <ActivityIndicator size="small" color={screenAccent} />
                <Text style={styles.typingText}>
                  Đang tải lịch sử trò chuyện…
                </Text>
              </View>
            ) : historyError ? (
              <View style={styles.emptyConversation}>
                <Text style={styles.emptyTitle}>
                  Chưa tải được cuộc trò chuyện
                </Text>
                <Text style={styles.emptyDescription}>{historyError}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Thử tải lại trò chuyện"
                  style={styles.newConversationButton}
                  onPress={() => setHistoryRetry(current => current + 1)}
                >
                  <Text style={styles.newConversationText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyConversation}>
                <View style={styles.emptyIcon}>
                  <MessageCircleMore size={24} color="#A75A18" />
                </View>
                <Text style={styles.emptyTitle}>Bạn muốn bắt đầu từ đâu?</Text>
                <Text style={styles.emptyDescription}>
                  Chọn một kế hoạch hoặc hỏi về khoản chi của bạn.
                </Text>
                <View style={styles.guidedList}>
                  {guidedPlans.map(plan => (
                    <TouchableOpacity
                      key={plan.title}
                      accessibilityRole="button"
                      accessibilityLabel={`Lập kế hoạch: ${plan.title}`}
                      disabled={isSending || voice.isBusy || isHistoryLoading}
                      style={styles.guidedRow}
                      onPress={() =>
                        handleSend(`${plan.question} trong ${planMonths} tháng`)
                      }
                    >
                      <View style={styles.guidedCopy}>
                        <Text style={styles.guidedTitle}>{plan.title}</Text>
                        <Text style={styles.guidedDescription}>
                          {plan.description}
                        </Text>
                      </View>
                      <ChevronRight size={18} color="#667085" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )
          }
          renderItem={({ item: message, index }) => {
            const dayKey = chatDateKey(message.created_at);
            const previousDayKey = index
              ? chatDateKey(messages[index - 1]?.created_at)
              : null;
            return (
              <View style={styles.messageItem}>
                {dayKey !== previousDayKey ? (
                  <View style={styles.dateSeparator}>
                    <View style={styles.dateLine} />
                    <Text style={styles.dateText}>
                      {formatChatDate(message.created_at)}
                    </Text>
                    <View style={styles.dateLine} />
                  </View>
                ) : null}
                <View
                  style={[
                    styles.messageBubble,
                    message.role === 'user'
                      ? styles.userBubble
                      : styles.assistantBubble,
                  ]}
                >
                  <View style={styles.messageMetaRow}>
                    <Text
                      style={[
                        styles.messageRole,
                        message.role === 'user' && styles.userMessageText,
                      ]}
                    >
                      {message.role === 'user' ? 'Bạn' : 'Trợ lý'}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        message.role === 'user' && styles.userMessageTime,
                      ]}
                    >
                      {formatChatTime(message.created_at)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.messageText,
                      message.role === 'user' && styles.userMessageText,
                    ]}
                  >
                    {message.content}
                  </Text>
                </View>

                {message.role === 'assistant' &&
                message.category_spending?.length ? (
                  <View style={styles.categorySpendingCard}>
                    <Text style={styles.categorySpendingTitle}>
                      Chi theo danh mục · {message.context_window_days ?? 120}{' '}
                      ngày
                    </Text>
                    {message.category_spending.map(item => (
                      <View
                        key={`${item.category_id}-${item.currency}`}
                        style={styles.categorySpendingRow}
                      >
                        <View style={styles.categorySpendingIcon}>
                          <CategoryIcon icon={item.icon} size={21} />
                        </View>
                        <Text
                          style={styles.categorySpendingName}
                          numberOfLines={1}
                        >
                          {item.category}
                        </Text>
                        <Text style={styles.categorySpendingAmount}>
                          {formatCurrency(item.amount, item.currency)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          }}
          ListFooterComponent={
            isHistoryLoading ? null : (
              <View style={styles.chatFooter}>
                {isSending ? (
                  <View style={[styles.messageBubble, styles.assistantBubble]}>
                    <View style={styles.typingRow}>
                      <ActivityIndicator size="small" color={screenAccent} />
                      <Text style={styles.typingText}>
                        Đang phân tích dữ liệu…
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View style={styles.safetyNote}>
                  <ShieldCheck size={17} color="#6E7D43" />
                  <Text style={styles.safetyText}>
                    AI chỉ phân tích và đề xuất; mọi thay đổi vẫn cần bạn xác
                    nhận.
                  </Text>
                </View>
              </View>
            )
          }
          scrollEventThrottle={32}
          onScroll={({ nativeEvent }) => {
            const distanceFromBottom =
              nativeEvent.contentSize.height -
              (nativeEvent.contentOffset.y +
                nativeEvent.layoutMeasurement.height);
            setShowScrollToBottom(distanceFromBottom > 72);
            if (
              nativeEvent.contentOffset.y <= 80 &&
              !shouldScrollToEndRef.current
            ) {
              handleLoadOlderMessages().catch(() => undefined);
            }
          }}
          onContentSizeChange={() => {
            if (!shouldScrollToEndRef.current) return;
            chatScrollRef.current?.scrollToEnd({ animated: false });
            setTimeout(() => {
              if (!shouldScrollToEndRef.current) return;
              chatScrollRef.current?.scrollToEnd({ animated: false });
              shouldScrollToEndRef.current = false;
              setShowScrollToBottom(false);
            }, 160);
          }}
        />
        {showScrollToBottom ? (
          <TouchableOpacity
            style={styles.scrollToBottomButton}
            activeOpacity={0.84}
            accessibilityLabel="Đi tới tin nhắn mới nhất"
            onPress={() => {
              shouldScrollToEndRef.current = false;
              chatScrollRef.current?.scrollToEnd({ animated: true });
              setShowScrollToBottom(false);
            }}
          >
            <ChevronDown size={22} color={screenAccent} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.controlsPanel}>
        <View style={styles.durationRow}>
          <Text style={styles.durationLabel}>Kế hoạch</Text>
          {[1, 2, 3, 4].map(months => (
            <TouchableOpacity
              key={months}
              accessibilityRole="button"
              accessibilityLabel={`Kế hoạch ${months} tháng`}
              accessibilityState={{ selected: planMonths === months }}
              disabled={isSending || voice.isBusy}
              onPress={() => setPlanMonths(months)}
              style={[
                styles.durationButton,
                planMonths === months && styles.durationSelected,
              ]}
            >
              <Text style={styles.durationLabel}>{months} tháng</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.promptSection}>
          <View style={styles.promptHeader}>
            <View style={styles.promptHeading}>
              <Text style={styles.sectionTitle}>Hỏi nhanh</Text>
            </View>
            {isSuggestionsLoading ? (
              <ActivityIndicator size="small" color={screenAccent} />
            ) : null}
          </View>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.promptRow}
          >
            {[
              ...new Set(['Gợi ý 3 kế hoạch tài chính', ...suggestedQuestions]),
            ].map(question => (
              <TouchableOpacity
                key={question}
                style={styles.promptChip}
                activeOpacity={0.82}
                disabled={isSending || voice.isBusy}
                onPress={() =>
                  handleSend(
                    question === 'Gợi ý 3 kế hoạch tài chính'
                      ? `${question} trong ${planMonths} tháng`
                      : question,
                  )
                }
              >
                <Text style={styles.promptText} numberOfLines={2}>
                  {question}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.voiceHint} accessibilityLiveRegion="polite">
          {voice.status === 'starting'
            ? 'Đang bật micro…'
            : voice.status === 'listening'
            ? 'Đang nghe… Bấm dừng khi nói xong.'
            : voice.status === 'stopping'
            ? 'Đang hoàn tất nhận dạng…'
            : 'Bấm micro để nói, kiểm tra nội dung rồi gửi. Bạn có thể ghi thu chi, nhập hóa đơn hoặc hỏi phân tích. Âm thanh có thể được dịch vụ nhận dạng của thiết bị xử lý.'}
        </Text>
        <View style={styles.composerWrap}>
          <TouchableOpacity
            accessibilityLabel="Chọn ảnh hóa đơn"
            style={styles.composerIconButton}
            activeOpacity={0.82}
            onPress={handleScanReceipt}
            disabled={voice.isBusy || isSending}
          >
            <Camera size={20} color="#B06A2B" />
          </TouchableOpacity>
          <TextInput
            accessibilityLabel="Câu hỏi cho trợ lý tài chính"
            style={styles.composerInput}
            placeholder="Ghi thu chi hoặc hỏi về chi tiêu..."
            placeholderTextColor="#B58A6A"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
            editable={!isSending && !voice.isBusy}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              voice.isBusy
                ? 'Dừng nhập giọng nói'
                : 'Nhập câu hỏi bằng giọng nói'
            }
            disabled={
              isSending ||
              voice.status === 'starting' ||
              voice.status === 'stopping'
            }
            style={styles.composerIconButton}
            onPress={() => {
              voice.toggle(draft).catch(() => undefined);
            }}
          >
            {voice.isBusy ? (
              <Square size={20} color="#B3261E" />
            ) : (
              <Mic size={20} color={screenAccent} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Gửi câu hỏi"
            disabled={
              !draft.trim() ||
              isSending ||
              isHistoryLoading ||
              Boolean(historyError) ||
              voice.isBusy
            }
            style={[
              styles.sendButton,
              draft.trim() && !isSending && styles.sendButtonActive,
            ]}
            activeOpacity={0.82}
            onPress={() => handleSend()}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Send size={18} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={isHistoryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsHistoryVisible(false)}
      >
        <View style={styles.historyOverlay}>
          <Pressable
            style={styles.historyBackdrop}
            onPress={() => setIsHistoryVisible(false)}
          />
          <View style={styles.historyDrawer}>
            <View style={styles.historyDrawerHeader}>
              <View>
                <Text style={styles.historyDrawerTitle}>
                  Lịch sử trò chuyện
                </Text>
                <Text style={styles.historyDrawerSubtitle}>
                  Lưu riêng cho tài khoản này
                </Text>
              </View>
              <TouchableOpacity
                style={styles.historyCloseButton}
                accessibilityLabel="Đóng lịch sử trò chuyện"
                onPress={() => setIsHistoryVisible(false)}
              >
                <X size={20} color="#6E4931" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              accessibilityLabel="Tạo cuộc trò chuyện mới"
              disabled={isSending}
              style={styles.newConversationButton}
              activeOpacity={0.84}
              onPress={handleNewConversation}
            >
              <Plus size={19} color={Colors.white} />
              <Text style={styles.newConversationText}>
                Cuộc trò chuyện mới
              </Text>
            </TouchableOpacity>

            <ScrollView
              style={styles.conversationList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.conversationListContent}
              scrollEventThrottle={32}
              onScroll={({ nativeEvent }) => {
                const distanceFromBottom =
                  nativeEvent.contentSize.height -
                  (nativeEvent.contentOffset.y +
                    nativeEvent.layoutMeasurement.height);
                if (distanceFromBottom <= 100) {
                  handleLoadMoreConversations().catch(() => undefined);
                }
              }}
            >
              {conversationGroups.length ? (
                conversationGroups.map(group => (
                  <View key={group.label} style={styles.conversationGroup}>
                    <Text style={styles.conversationGroupLabel}>
                      {group.label}
                    </Text>
                    {group.items.map(conversation => {
                      const isActive = conversation.id === activeConversationId;
                      return (
                        <TouchableOpacity
                          key={conversation.id}
                          accessibilityLabel={`Mở cuộc trò chuyện ${conversation.id}`}
                          disabled={isSending}
                          style={[
                            styles.conversationItem,
                            isActive && styles.conversationItemActive,
                          ]}
                          activeOpacity={0.82}
                          onPress={() =>
                            handleSelectConversation(conversation.id)
                          }
                        >
                          <View style={styles.conversationItemHeader}>
                            <Text
                              style={styles.conversationItemTitle}
                              numberOfLines={1}
                            >
                              {conversation.title}
                            </Text>
                            <Text style={styles.conversationItemTime}>
                              {formatChatTime(conversation.updated_at)}
                            </Text>
                          </View>
                          <Text
                            style={styles.conversationItemPreview}
                            numberOfLines={2}
                          >
                            {conversation.last_message ||
                              `${conversation.message_count} tin nhắn`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))
              ) : (
                <View style={styles.emptyHistory}>
                  <MessageCircleMore size={27} color="#B06A2B" />
                  <Text style={styles.emptyHistoryTitle}>
                    Chưa có cuộc trò chuyện
                  </Text>
                  <Text style={styles.emptyHistoryText}>
                    Gửi câu hỏi đầu tiên để tạo lịch sử.
                  </Text>
                </View>
              )}
              {isLoadingMoreConversations ? (
                <View style={styles.moreConversationsLoading}>
                  <ActivityIndicator size="small" color={screenAccent} />
                  <Text style={styles.typingText}>Đang tải thêm…</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
    flexWrap: 'wrap',
  },
  durationLabel: { color: '#20262D', fontSize: 12 },
  durationButton: {
    minHeight: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  durationSelected: { backgroundColor: '#FAEEE3', borderColor: screenAccent },
  guidedList: { alignSelf: 'stretch', marginTop: 20 },
  guidedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 16,
  },
  guidedCopy: { flex: 1 },
  guidedTitle: { color: '#20262D', fontSize: 15, fontWeight: '600' },
  guidedDescription: {
    color: '#667085',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  voiceHint: {
    color: '#667085',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F6F8',
    paddingTop: 18,
    paddingBottom: 82,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
  },
  assistantMark: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#F1EEE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#20262D',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#667085',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  statusBadge: {
    minWidth: 72,
    height: 38,
    paddingHorizontal: 11,
    borderRadius: 15,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  statusText: {
    color: screenAccent,
    fontSize: 12,
    fontWeight: '700',
  },
  contextBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    minHeight: 62,
    borderRadius: 12,
    backgroundColor: '#FFFDFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 170,
  },
  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#A94F18',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    color: '#20262D',
    fontSize: 22,
    fontWeight: '700',
  },
  heroDescription: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  contextCard: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#FFFDFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 15,
  },
  contextHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contextIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextHeaderCopy: { flex: 1 },
  contextTitle: { color: '#20262D', fontSize: 15, fontWeight: '700' },
  contextSubtitle: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  contextLink: { color: screenAccent, fontSize: 12, fontWeight: '700' },
  contextSummary: { flexDirection: 'row', gap: 10, marginTop: 14 },
  contextMetric: {
    flex: 1,
    borderRadius: 15,
    backgroundColor: '#FFF4E9',
    padding: 11,
  },
  contextMetricLabel: { color: '#667085', fontSize: 10, fontWeight: '600' },
  contextMetricValue: {
    color: '#20262D',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
  contextGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 11,
  },
  contextGoalName: {
    width: 92,
    color: '#6E4931',
    fontSize: 11,
    fontWeight: '600',
  },
  contextGoalTrack: {
    flex: 1,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#FFE3C8',
    overflow: 'hidden',
  },
  contextGoalFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: screenAccent,
  },
  contextGoalPercent: {
    width: 34,
    textAlign: 'right',
    color: screenAccent,
    fontSize: 11,
    fontWeight: '700',
  },
  contextEmpty: {
    marginTop: 12,
    borderRadius: 15,
    backgroundColor: '#FFF4E9',
    padding: 12,
  },
  contextEmptyText: {
    color: '#667085',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  contextCreateButton: {
    alignSelf: 'flex-start',
    marginTop: 9,
    borderRadius: 12,
    backgroundColor: screenAccent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contextCreateText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  actionCard: {
    flex: 1,
    minHeight: 184,
    backgroundColor: '#FFFDFB',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    color: '#20262D',
    fontSize: 15,
    fontWeight: '700',
  },
  actionDescription: {
    flex: 1,
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 6,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  actionLinkText: {
    color: screenAccent,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    color: '#20262D',
    fontSize: 15,
    fontWeight: '700',
  },
  controlsPanel: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: '#EBC9AC',
    paddingTop: 11,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  promptSection: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  promptHeader: {
    minHeight: 24,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promptHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  promptRow: { gap: 9, paddingRight: 4 },
  promptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  promptChip: {
    width: 190,
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: '#FFFDFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  promptText: {
    color: '#7A4A28',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
  chatPanel: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: '#EBC9AC',
    overflow: 'hidden',
  },
  chatFrame: {
    flex: 1,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E8B680',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7A3E12',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 7,
  },
  chatContent: {
    flexGrow: 1,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 14,
  },
  historyLoading: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  olderMessagesLoading: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  emptyConversation: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    flex: 1,
  },
  emptyTitle: {
    color: '#20262D',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyDescription: {
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },
  conversation: { gap: 10 },
  messageItem: { gap: 10, marginBottom: 10 },
  chatFooter: { marginTop: 2 },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginVertical: 5,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: '#EFD8C5' },
  dateText: { color: '#9A7355', fontSize: 11, fontWeight: '600' },
  messageBubble: {
    maxWidth: '88%',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: screenAccent,
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 6,
  },
  messageRole: {
    color: screenAccent,
    fontSize: 11,
    fontWeight: '700',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 5,
  },
  messageTime: { color: '#A17B5D', fontSize: 10, fontWeight: '700' },
  userMessageTime: { color: 'rgba(255,255,255,0.72)' },
  messageText: {
    color: '#20262D',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  userMessageText: { color: Colors.white },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { color: '#667085', fontSize: 12, fontWeight: '700' },
  categorySpendingCard: {
    width: '100%',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#FFFDFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 9,
  },
  categorySpendingTitle: {
    color: '#20262D',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  categorySpendingRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: '#FFF4E9',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  categorySpendingIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySpendingName: {
    flex: 1,
    color: '#5A3520',
    fontSize: 13,
    fontWeight: '700',
  },
  categorySpendingAmount: {
    color: screenAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  safetyText: {
    flex: 1,
    color: '#66703E',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  composerWrap: {
    marginHorizontal: 12,
    minHeight: 62,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
    shadowColor: '#7A3E12',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
  },
  composerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    color: '#20262D',
    fontSize: 15,
    fontWeight: '700',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#D8A06A',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  sendButtonActive: {
    backgroundColor: screenAccent,
    opacity: 1,
  },
  historyOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(63, 33, 17, 0.2)',
  },
  historyBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  historyDrawer: {
    width: '86%',
    maxWidth: 380,
    height: '100%',
    backgroundColor: '#FFF9F3',
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: Platform.OS === 'android' ? 42 : 56,
    paddingHorizontal: 16,
    paddingBottom: 24,
    shadowColor: '#20262D',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 18,
  },
  historyDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyDrawerTitle: {
    color: '#20262D',
    fontSize: 20,
    fontWeight: '700',
  },
  historyDrawerSubtitle: {
    color: '#9A7355',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  historyCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newConversationButton: {
    minHeight: 50,
    borderRadius: 17,
    backgroundColor: screenAccent,
    marginTop: 18,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  newConversationText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  conversationList: { flex: 1, marginTop: 12 },
  conversationListContent: { paddingBottom: 24 },
  moreConversationsLoading: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  conversationGroup: { marginTop: 12, gap: 8 },
  conversationGroupLabel: {
    color: '#9A7355',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  conversationItem: {
    borderRadius: 17,
    backgroundColor: '#FFFDFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  conversationItemActive: {
    backgroundColor: '#FFF0DF',
    borderColor: '#F2A764',
  },
  conversationItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conversationItemTitle: {
    flex: 1,
    color: '#20262D',
    fontSize: 13,
    fontWeight: '700',
  },
  conversationItemTime: {
    color: '#A17B5D',
    fontSize: 10,
    fontWeight: '700',
  },
  conversationItemPreview: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 5,
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 54,
    paddingHorizontal: 24,
  },
  emptyHistoryTitle: {
    color: '#20262D',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyHistoryText: {
    color: '#9A7355',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 5,
  },
});

export default ChatbotScreen;
