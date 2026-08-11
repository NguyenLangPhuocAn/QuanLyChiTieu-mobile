import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Bot,
  Camera,
  ChevronRight,
  MessageCircleMore,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';

const suggestedQuestions = [
  'Tóm tắt chi tiêu tháng này',
  'Tôi chi nhiều nhất vào đâu?',
  'Kiểm tra ngân sách của tôi',
  'Các khoản nợ sắp đến hạn',
];

const ChatbotScreen = () => {
  const [draft, setDraft] = useState('');

  const showPendingIntegration = (feature: string) => {
    Alert.alert(
      'Đang chờ kết nối AI',
      `${feature} sẽ sẵn sàng sau khi dịch vụ chatbot được kết nối với dữ liệu của bạn.`,
    );
  };

  const handleSuggestionPress = (question: string) => {
    setDraft(question);
  };

  const handleSend = () => {
    if (!draft.trim()) {
      return;
    }

    showPendingIntegration('Gửi câu hỏi');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.assistantMark}>
          <Bot size={24} color={Colors.white} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Trợ lý tài chính</Text>
          <Text style={styles.subtitle}>
            Hỏi đáp và ghi chép chi tiêu bằng AI
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Sparkles size={15} color={Colors.primary} />
          <Text style={styles.statusText}>AI</Text>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MessageCircleMore size={30} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Bạn cần hỗ trợ gì?</Text>
          <Text style={styles.heroDescription}>
            Hỏi về giao dịch, ví, ngân sách hoặc dùng ảnh hóa đơn để chuẩn bị
            một giao dịch mới.
          </Text>
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.82}
            onPress={() => setDraft('')}
          >
            <View style={styles.actionIcon}>
              <MessageCircleMore size={22} color={Colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Hỏi về chi tiêu</Text>
            <Text style={styles.actionDescription}>
              Nhập câu hỏi ở ô trò chuyện bên dưới.
            </Text>
            <View style={styles.actionLink}>
              <Text style={styles.actionLinkText}>Bắt đầu hỏi</Text>
              <ChevronRight size={16} color={Colors.primary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.82}
            onPress={() => showPendingIntegration('Quét hóa đơn')}
          >
            <View style={styles.actionIcon}>
              <Camera size={22} color={Colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Quét hóa đơn</Text>
            <Text style={styles.actionDescription}>
              Chụp hoặc chọn ảnh để điền giao dịch.
            </Text>
            <View style={styles.actionLink}>
              <Text style={styles.actionLinkText}>Chọn hình ảnh</Text>
              <ChevronRight size={16} color={Colors.primary} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Câu hỏi gợi ý</Text>
          <View style={styles.promptGrid}>
            {suggestedQuestions.map(question => (
              <TouchableOpacity
                key={question}
                style={styles.promptChip}
                activeOpacity={0.82}
                onPress={() => handleSuggestionPress(question)}
              >
                <Text style={styles.promptText}>{question}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.emptyConversation}>
          <View style={styles.emptyIcon}>
            <ReceiptText size={25} color="#A75A18" />
          </View>
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện</Text>
            <Text style={styles.emptyDescription}>
              Câu trả lời và bản nháp giao dịch sẽ xuất hiện tại đây khi dịch vụ
              AI được kết nối.
            </Text>
          </View>
        </View>

        <View style={styles.safetyNote}>
          <ShieldCheck size={19} color="#6E7D43" />
          <Text style={styles.safetyText}>
            Giao dịch do AI đề xuất sẽ luôn cần bạn kiểm tra và xác nhận trước
            khi lưu.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.composerWrap}>
        <TouchableOpacity
          accessibilityLabel="Chọn ảnh hóa đơn"
          style={styles.composerIconButton}
          activeOpacity={0.82}
          onPress={() => showPendingIntegration('Quét hóa đơn')}
        >
          <Camera size={20} color="#B06A2B" />
        </TouchableOpacity>
        <TextInput
          style={styles.composerInput}
          placeholder="Hỏi về chi tiêu của bạn..."
          placeholderTextColor="#B58A6A"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          accessibilityLabel="Gửi câu hỏi"
          disabled={!draft.trim()}
          style={[styles.sendButton, draft.trim() && styles.sendButtonActive]}
          activeOpacity={0.82}
          onPress={handleSend}
        >
          <Send size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E8',
    paddingTop: 18,
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#4C2A18',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: '#8A623F',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  statusBadge: {
    minWidth: 54,
    height: 38,
    paddingHorizontal: 11,
    borderRadius: 15,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#F0D5BE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  statusText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 170,
  },
  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0D5BE',
    shadowColor: '#A94F18',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: '#FFF0DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    color: '#4C2A18',
    fontSize: 22,
    fontWeight: '900',
  },
  heroDescription: {
    color: '#8A623F',
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
  actionCard: {
    flex: 1,
    minHeight: 184,
    backgroundColor: '#FFFDFB',
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: '#F0D5BE',
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
    color: '#4C2A18',
    fontSize: 15,
    fontWeight: '900',
  },
  actionDescription: {
    flex: 1,
    color: '#8A623F',
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
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    color: '#4C2A18',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 12,
  },
  promptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  promptChip: {
    borderRadius: 999,
    backgroundColor: '#FFFDFB',
    borderWidth: 1,
    borderColor: '#F0D5BE',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  promptText: {
    color: '#7A4A28',
    fontWeight: '800',
    fontSize: 13,
  },
  emptyConversation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 22,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E6C4A8',
    backgroundColor: 'rgba(255,255,255,0.52)',
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
    color: '#4C2A18',
    fontSize: 14,
    fontWeight: '900',
  },
  emptyDescription: {
    color: '#8A623F',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
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
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 82,
    minHeight: 62,
    borderRadius: 22,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#F0D5BE',
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
    color: '#4C2A18',
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
    backgroundColor: Colors.primary,
    opacity: 1,
  },
});

export default ChatbotScreen;
