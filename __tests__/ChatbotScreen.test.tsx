import React from 'react';
import { FlatList } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import ChatbotScreen from '../src/screens/home/ChatbotScreen';
import { chatbotService } from '../src/services/chatbot';
import { RNSpeechRecognitionModule as speech } from 'rn-speech-recognition';
import type {
  ChatbotConversation,
  ChatbotHistoryResponse,
} from '../src/types/chatbot';

jest.mock('@react-navigation/native', () => {
  const navigation = {
    navigate: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
  return { useNavigation: () => navigation };
});
jest.mock('rn-speech-recognition', () => ({
  RNSpeechRecognitionModule: {
    isAvailable: true,
    isRecognitionAvailable: jest.fn(() => true),
    requestPermissionsAsync: jest.fn(),
    addListener: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  },
}));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test' }),
}));
jest.mock('../src/services/savings', () => ({
  savingsService: { getContext: jest.fn().mockResolvedValue(null) },
}));
jest.mock('../src/services/chatbot', () => ({
  chatbotService: {
    conversations: jest.fn(),
    conversationHistory: jest.fn(),
    suggestions: jest.fn(),
    send: jest.fn(),
  },
}));
const service = jest.mocked(chatbotService);
const recognition = jest.mocked(speech);
let speechEvents: Record<string, (event?: unknown) => void>;
const conversations: ChatbotConversation[] = [1, 2, 3].map(id => ({
  id,
  title: `Trò chuyện ${id}`,
  message_count: 1,
  created_at: '2026-09-21T08:00:00Z',
  updated_at: '2026-09-21T08:00:00Z',
}));
const history = (id: number): ChatbotHistoryResponse => ({
  messages: [{ id, role: 'assistant', content: `Lịch sử ${id}` }],
  has_more: false,
  next_cursor: null,
});
let renderer: TestRenderer.ReactTestRenderer;
const press = (label: string) =>
  renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
const mount = async (
  props: React.ComponentProps<typeof ChatbotScreen> = {},
) => {
  await act(async () => {
    renderer = TestRenderer.create(<ChatbotScreen {...props} />);
  });
};
beforeEach(() => {
  jest.clearAllMocks();
  speechEvents = {};
  recognition.requestPermissionsAsync.mockResolvedValue({
    granted: true,
  } as never);
  recognition.addListener.mockImplementation((name, callback) => {
    speechEvents[name] = callback as (event?: unknown) => void;
    return { remove: jest.fn() };
  });
  service.conversations.mockResolvedValue({
    conversations,
    has_more: false,
    next_cursor: null,
  });
  service.conversationHistory.mockImplementation(async (_token, id) =>
    history(id),
  );
  service.suggestions.mockResolvedValue({
    suggestions: [],
    generated_for: '',
    source: 'FALLBACK',
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

it.each([
  {
    message: 'Thêm tiền ăn sáng 30 nghìn',
    action: {
      type: 'CREATE_TRANSACTION',
      draft: {
        type: 'EXPENSE',
        amount: 30000,
        currency: 'VND',
        note: 'Ăn sáng',
        transaction_date: null,
        wallet_name: null,
        category_name: null,
      },
    },
  },
  { message: 'Nhập hóa đơn này', action: { type: 'SCAN_RECEIPT' } },
  { message: 'Hóa đơn điện tăng vì sao?', action: null },
])(
  'routes "$message" only after the transcript is sent and the backend identifies an action',
  async ({ message, action }) => {
    const onScanReceipt = jest.fn();
    const onCreateTransaction = jest.fn();
    service.send.mockResolvedValue({
      conversation_id: 1,
      user_message: { id: 4, role: 'user', content: message },
      assistant_message: {
        id: 5,
        role: 'assistant',
        content: 'Kiểm tra thông tin',
      },
      action,
    } as never);
    await mount({ onScanReceipt, onCreateTransaction });
    await act(async () => press('Nhập câu hỏi bằng giọng nói'));
    await act(async () => speechEvents.start());
    await act(async () =>
      speechEvents.result({
        results: [{ transcript: message }],
        isFinal: true,
      }),
    );
    await act(async () => speechEvents.end());
    expect(onScanReceipt).not.toHaveBeenCalled();
    expect(onCreateTransaction).not.toHaveBeenCalled();
    expect(service.send).not.toHaveBeenCalled();
    await act(async () => press('Gửi câu hỏi'));
    expect(service.send).toHaveBeenCalledTimes(1);
    if (action?.type === 'CREATE_TRANSACTION')
      expect(onCreateTransaction).toHaveBeenCalledWith(action.draft);
    else expect(onCreateTransaction).not.toHaveBeenCalled();
    expect(onScanReceipt).toHaveBeenCalledTimes(
      action?.type === 'SCAN_RECEIPT' ? 1 : 0,
    );
  },
);

it.each([
  ['Hôm nay ăn sáng', 'Hôm nay ăn sáng 30 nghìn', 'Hôm nay ăn sáng 35 nghìn'],
  ['Phân tích', 'Phân tích chi tiêu tháng này', 'Phân tích chi tiêu tháng này'],
])(
  'keeps speech "%s" as an editable draft until Send is pressed',
  async (partial, final, edited) => {
    service.send.mockResolvedValue({
      conversation_id: 1,
      user_message: { id: 4, role: 'user', content: edited },
      assistant_message: {
        id: 5,
        role: 'assistant',
        content: 'Phản hồi thử nghiệm',
      },
    } as never);
    await mount();
    const input = () =>
      renderer.root.findByProps({
        accessibilityLabel: 'Câu hỏi cho trợ lý tài chính',
      });
    await act(async () => press('Nhập câu hỏi bằng giọng nói'));
    expect(recognition.start).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'vi-VN' }),
    );
    await act(async () => speechEvents.start());
    await act(async () =>
      speechEvents.result({
        results: [{ transcript: partial }],
        isFinal: false,
      }),
    );
    expect(input().props.value).toBe(partial);
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Gửi câu hỏi' }).props
        .disabled,
    ).toBe(true);
    await act(async () => press('Gửi câu hỏi'));
    expect(service.send).not.toHaveBeenCalled();
    await act(async () => press('Dừng nhập giọng nói'));
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    await act(async () =>
      speechEvents.result({ results: [{ transcript: final }], isFinal: true }),
    );
    await act(async () => speechEvents.end());
    expect(input().props.value).toBe(final);
    expect(input().props.editable).toBe(true);
    expect(service.send).not.toHaveBeenCalled();
    await act(async () => input().props.onChangeText(edited));
    await act(async () => press('Gửi câu hỏi'));
    expect(service.send).toHaveBeenCalledTimes(1);
    expect(service.send).toHaveBeenCalledWith('test', edited, 1);
    expect(input().props.value).toBe('');
    expect(renderer.root.findByType(FlatList).props.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: edited }),
        expect.objectContaining({
          role: 'assistant',
          content: 'Phản hồi thử nghiệm',
        }),
      ]),
    );
  },
);

it('shows a retry for unavailable history and does not silently create a new chat', async () => {
  service.conversations.mockRejectedValueOnce(new Error('Mất kết nối mạng'));
  await mount();
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Câu hỏi cho trợ lý tài chính' })
      .props.onChangeText('Kế hoạch tháng này');
  });
  await act(async () => {
    await press('Gửi câu hỏi');
  });
  expect(service.send).not.toHaveBeenCalled();
  await act(async () => {
    press('Thử tải lại trò chuyện');
  });
  expect(renderer.root.findByType(FlatList).props.data).toEqual(
    history(1).messages,
  );
});

it('sends only once when the same Send handler is tapped twice before rendering', async () => {
  service.send.mockResolvedValue({
    conversation_id: 1,
    user_message: { id: 4, role: 'user', content: 'Kế hoạch 2 tháng' },
    assistant_message: { id: 5, role: 'assistant', content: 'Kế hoạch thử' },
  } as never);
  await mount();
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Câu hỏi cho trợ lý tài chính' })
      .props.onChangeText('Kế hoạch 2 tháng');
  });
  await act(async () => {
    await Promise.all([press('Gửi câu hỏi'), press('Gửi câu hỏi')]);
  });
  expect(service.send).toHaveBeenCalledTimes(1);
  expect(service.send).toHaveBeenCalledWith('test', 'Kế hoạch 2 tháng', 1);
  expect(
    renderer.root
      .findByType(FlatList)
      .props.data.map((message: { id: number }) => message.id),
  ).toEqual([1, 4, 5]);
});

it('does not restore initial history after the user starts a new conversation', async () => {
  let finish!: (value: ChatbotHistoryResponse) => void;
  service.conversationHistory.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await mount();
  await act(async () => {
    press('Mở lịch sử trò chuyện');
  });
  await act(async () => {
    press('Tạo cuộc trò chuyện mới');
  });
  await act(async () => {
    finish(history(1));
  });
  expect(renderer.root.findByType(FlatList).props.data).toEqual([]);
});

it('keeps the last selected conversation when the previous request finishes later', async () => {
  await mount();
  let finish!: (value: ChatbotHistoryResponse) => void;
  service.conversationHistory.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  await act(async () => {
    press('Mở lịch sử trò chuyện');
  });
  let pending!: Promise<void>;
  await act(async () => {
    pending = press('Mở cuộc trò chuyện 2');
  });
  await act(async () => {
    press('Mở lịch sử trò chuyện');
  });
  await act(async () => {
    await press('Mở cuộc trò chuyện 3');
  });
  await act(async () => {
    finish(history(2));
    await pending;
  });
  expect(renderer.root.findByType(FlatList).props.data).toEqual(
    history(3).messages,
  );
});
