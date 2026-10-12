import { NativeModules, Platform } from 'react-native';

export type PickedDocument = {
  uri: string;
  name: string;
  type: string;
};

const nativePicker = NativeModules.LocalDocumentPicker as
  | {
      pickExcelFile(): Promise<PickedDocument | null>;
    }
  | undefined;

export const localDocumentPicker = {
  async pickExcelFile() {
    if (Platform.OS !== 'android' || !nativePicker) {
      throw new Error('Thiết bị này chưa hỗ trợ chọn file Excel.');
    }
    return nativePicker.pickExcelFile();
  },
};
