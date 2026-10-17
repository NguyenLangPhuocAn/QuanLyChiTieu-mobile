import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PickedDocument } from '../native/documentPicker';
import type { ChatTransactionDraft } from '../types/chatbot';
import type { ReceiptItem } from '../types/transaction';
import type { ExcelImportPreview } from './dataTransfer';

export type FinancialCaptureSource = 'OCR' | 'VOICE' | 'EXCEL';
export type FinancialCaptureStatus = 'READY' | 'NEEDS_REVIEW';

export type FinancialCaptureDraft = {
  id: string;
  dedupeKey: string;
  source: FinancialCaptureSource;
  status: FinancialCaptureStatus;
  title: string;
  createdAt: string;
  updatedAt: string;
  transactionDraft?: ChatTransactionDraft;
  receiptItems?: ReceiptItem[];
  excel?: {
    file: PickedDocument;
    preview: ExcelImportPreview;
  };
};

type FinancialCaptureInput = Omit<
  FinancialCaptureDraft,
  'id' | 'createdAt' | 'updatedAt'
>;

const storageKey = (userId: number) =>
  `quan_ly_chi_tieu_financial_capture_inbox_v1_${userId}`;

const parseDrafts = (raw: string | null): FinancialCaptureDraft[] => {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(item => {
      if (!item || typeof item !== 'object') return false;
      const draft = item as Partial<FinancialCaptureDraft>;
      return Boolean(
        draft.id &&
          draft.dedupeKey &&
          draft.title &&
          ['OCR', 'VOICE', 'EXCEL'].includes(draft.source ?? '') &&
          ['READY', 'NEEDS_REVIEW'].includes(draft.status ?? ''),
      );
    }) as FinancialCaptureDraft[];
  } catch {
    return [];
  }
};

const save = (userId: number, drafts: FinancialCaptureDraft[]) =>
  AsyncStorage.setItem(storageKey(userId), JSON.stringify(drafts));

const createId = (source: FinancialCaptureSource) =>
  `${source.toLowerCase()}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;

export const financialCaptureInbox = {
  async list(userId: number) {
    return parseDrafts(await AsyncStorage.getItem(storageKey(userId))).sort(
      (left, right) => right.updatedAt.localeCompare(left.updatedAt),
    );
  },

  async enqueue(userId: number, input: FinancialCaptureInput) {
    const drafts = await this.list(userId);
    const existing = drafts.find(item => item.dedupeKey === input.dedupeKey);
    const now = new Date().toISOString();
    if (existing) {
      const updated = { ...existing, ...input, updatedAt: now };
      await save(
        userId,
        drafts.map(item => (item.id === existing.id ? updated : item)),
      );
      return updated;
    }
    const draft: FinancialCaptureDraft = {
      ...input,
      id: createId(input.source),
      createdAt: now,
      updatedAt: now,
    };
    await save(userId, [draft, ...drafts]);
    return draft;
  },

  async get(userId: number, id: string) {
    return (await this.list(userId)).find(item => item.id === id) ?? null;
  },

  async remove(userId: number, id: string) {
    const drafts = await this.list(userId);
    await save(
      userId,
      drafts.filter(item => item.id !== id),
    );
  },
};
