import { NativeModules, Platform } from 'react-native';

export type PickedDocument = {
  uri: string;
  name: string;
  type: string;
};

const nativePicker = NativeModules.LocalDocumentPicker as
  | {
      pickExcelFile(): Promise<PickedDocument | null>;
      pickBackupFile(): Promise<PickedDocument | null>;
      saveBase64File(
        filename: string,
        mimeType: string,
        base64: string,
      ): Promise<PickedDocument | null>;
    }
  | undefined;

export const localDocumentPicker = {
  async pickExcelFile() {
    if (Platform.OS !== 'android' || !nativePicker) {
      throw new Error('Thiết bị này chưa hỗ trợ chọn file Excel.');
    }
    return nativePicker.pickExcelFile();
  },
  async pickBackupFile() {
    if (Platform.OS !== 'android' || !nativePicker) {
      throw new Error('Thiết bị này chưa hỗ trợ chọn file backup.');
    }
    return nativePicker.pickBackupFile();
  },
  async saveBase64File(filename: string, mimeType: string, base64: string) {
    if (Platform.OS !== 'android' || !nativePicker) {
      throw new Error('Thiết bị này chưa hỗ trợ lưu file vào thư mục đã chọn.');
    }
    return nativePicker.saveBase64File(filename, mimeType, base64);
  },
};
