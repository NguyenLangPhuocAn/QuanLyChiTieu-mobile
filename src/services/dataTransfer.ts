import { apiUploadRequest } from './api';
import type { PickedDocument } from '../native/documentPicker';

export type ExcelImportResult = {
  created: number;
  skipped: number;
  failed: number;
  warnings: string[];
};

export const dataTransferService = {
  importExcel(token: string, file: PickedDocument) {
    return apiUploadRequest<ExcelImportResult>(
      '/transactions/import-excel',
      token,
      file,
      'POST',
      120_000,
    );
  },
};
