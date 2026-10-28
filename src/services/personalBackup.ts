import type { PickedDocument } from '../native/documentPicker';
import { apiRequest, apiUploadRequest } from './api';

export type BackupPreviewRow = {
  row: number;
  status: 'READY' | 'DUPLICATE' | 'INVALID';
  reason: string;
  wallet: { name: string; currency: string };
  category: { name: string; type: 'INCOME' | 'EXPENSE' } | null;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  note: string | null;
  transactionDate: string;
};

export type BackupPreview = {
  metadata: {
    version: number;
    createdAt: string;
    dataTypes: string[];
    fileHash: string;
  };
  summary: { total: number; ready: number; duplicate: number; invalid: number };
  rows: BackupPreviewRow[];
};

export const getVisibleReadyBackupRowNumbers = (
  rows: BackupPreviewRow[],
  visibleCount: number,
) =>
  rows
    .slice(0, Math.max(0, visibleCount))
    .filter(row => row.status === 'READY')
    .map(row => row.row);

type BackupExport = {
  filename: string;
  mimeType: string;
  base64: string;
  summary: {
    createdAt: string;
    dataTypes: string[];
    wallets: number;
    transactions: number;
  };
};

export const personalBackupService = {
  export(token: string) {
    return apiRequest<BackupExport>('/personal-backup/export', {
      method: 'POST',
      token,
      timeoutMs: 120_000,
    });
  },

  preview(token: string, file: PickedDocument) {
    return apiUploadRequest<BackupPreview>(
      '/personal-backup/preview',
      token,
      file,
      'POST',
      120_000,
    );
  },

  restore(
    token: string,
    file: PickedDocument,
    rows: number[],
    fileHash: string,
  ) {
    if (!/^[a-f0-9]{64}$/.test(fileHash)) {
      throw new Error('Hãy xem trước file backup trước khi khôi phục.');
    }
    return apiUploadRequest<{
      restored: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; reason: string }>;
    }>(
      `/personal-backup/restore?rows=${encodeURIComponent(
        rows.join(','),
      )}&fileHash=${encodeURIComponent(fileHash)}`,
      token,
      file,
      'POST',
      120_000,
    );
  },
};
