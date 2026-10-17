import { apiRequest, apiUploadRequest } from './api';
import type { PickedDocument } from '../native/documentPicker';

export type ExcelImportResult = {
  batchId: number | null;
  created: number;
  skipped: number;
  failed: number;
  warnings: string[];
};

export type ExcelPreviewRow = {
  row: number;
  status: 'READY' | 'DUPLICATE' | 'INVALID' | 'UNSUPPORTED';
  date?: string;
  type?: 'INCOME' | 'EXPENSE';
  wallet?: string;
  category?: string | null;
  amount?: number;
  note?: string;
  reason?: string;
};

export type ExcelImportPreview = {
  fileHash: string;
  totalRows: number;
  ready: number;
  duplicates: number;
  invalid: number;
  unsupported: number;
  rows: ExcelPreviewRow[];
  warnings: string[];
};

export type ExcelUndoResult = {
  batchId: number;
  removed: number;
  failed: number;
  warnings: string[];
};

export const dataTransferService = {
  previewExcel(token: string, file: PickedDocument) {
    return apiUploadRequest<ExcelImportPreview>(
      '/transactions/preview-excel',
      token,
      file,
      'POST',
      120_000,
    );
  },

  importExcel(token: string, file: PickedDocument, selectedRows?: number[]) {
    const rowQuery = selectedRows?.length
      ? `?rows=${encodeURIComponent(selectedRows.join(','))}`
      : '';
    return apiUploadRequest<ExcelImportResult>(
      `/transactions/import-excel${rowQuery}`,
      token,
      file,
      'POST',
      120_000,
    );
  },

  undoExcelImport(token: string, batchId: number) {
    return apiRequest<ExcelUndoResult>(
      `/transactions/import-batches/${batchId}`,
      {
        method: 'DELETE',
        token,
      },
    );
  },
};
