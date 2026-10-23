import { NativeModules, Platform } from 'react-native';

export type ScreenCapture = {
  uri: string;
  width: number;
  height: number;
  capturedAt: number;
};
export type ScreenCrop = Omit<ScreenCapture, 'capturedAt'> & {
  text: string;
  sourceRef: string;
};
export type CropBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
type CaptureNative = {
  isReady(): Promise<boolean>;
  prepare(): Promise<boolean>;
  capture(): Promise<ScreenCapture>;
  recognize(
    uri: string,
    left: number,
    top: number,
    right: number,
    bottom: number,
  ): Promise<ScreenCrop>;
  deleteCapture(uri: string): Promise<boolean>;
  stop(): Promise<boolean>;
};
const native = NativeModules.BankScreenCapture as CaptureNative | undefined;
function requireNative() {
  if (Platform.OS !== 'android' || !native)
    throw new Error('Đọc banner cần bản Android có hỗ trợ chụp màn hình.');
  return native;
}
export const bankScreenCapture = {
  isReady: () => requireNative().isReady(),
  prepare: () => requireNative().prepare(),
  capture: () => requireNative().capture(),
  recognize: (uri: string, bounds: CropBounds) =>
    requireNative().recognize(
      uri,
      bounds.left,
      bounds.top,
      bounds.right,
      bounds.bottom,
    ),
  deleteCapture: async (uri: string) => native?.deleteCapture(uri),
  stop: async () => native?.stop(),
};
