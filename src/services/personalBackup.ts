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
  metadata: { version: number; createdAt: string; dataTypes: string[] };
  summary: { total: number; ready: number; duplicate: number; invalid: number };
  rows: BackupPreviewRow[];
};

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
  export(token: string, password: string) {
    return apiRequest<BackupExport>('/personal-backup/export', {
      method: 'POST',
      token,
      body: { password },
      timeoutMs: 120_000,
    });
  },

  preview(token: string, file: PickedDocument, password: string) {
    return apiUploadRequest<BackupPreview>(
      '/personal-backup/preview',
      token,
      file,
      'POST',
      120_000,
      { password },
    );
  },

  restore(
    token: string,
    file: PickedDocument,
    password: string,
    rows: number[],
  ) {
    return apiUploadRequest<{
      restored: number;
      failed: number;
      skipped: number;
      errors: Array<{ row: number; reason: string }>;
    }>(
      `/personal-backup/restore?rows=${encodeURIComponent(rows.join(','))}`,
      token,
      file,
      'POST',
      120_000,
      { password },
    );
  },
};
