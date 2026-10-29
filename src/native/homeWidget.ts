import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
const native = NativeModules.NovaHomeWidget as
  | {
      activate(scope: string | null): Promise<void>;
      update(scope: string, json: string): Promise<void>;
      requestPin(kind: 'mini' | 'full'): Promise<boolean>;
      isConnected(): Promise<boolean>;
      validateLink(scope: string, url: string): Promise<boolean>;
      closeQuickEntry(result: string): Promise<boolean>;
      entryReady?(): Promise<void>;
      addListener(name: string): void;
      removeListeners(count: number): void;
    }
  | undefined;
export const homeWidget = {
  supported: Platform.OS === 'android' && !!native,
  activate: (scope: string | null) =>
    native?.activate(scope) ?? Promise.resolve(),
  update: (scope: string, data: unknown) =>
    native?.update(scope, JSON.stringify(data)) ?? Promise.resolve(),
  requestPin: (kind: 'mini' | 'full' = 'full') =>
    native?.requestPin(kind) ?? Promise.resolve(false),
  connected: () => native?.isConnected() ?? Promise.resolve(true),
  validateLink: (scope: string, url: string) =>
    native?.validateLink?.(scope, url) ?? Promise.resolve(false),
  closeQuickEntry: (result = 'CANCEL') =>
    native?.closeQuickEntry?.(result) ?? Promise.resolve(false),
  entryReady: () => native?.entryReady?.() ?? Promise.resolve(),
  subscribe(listener: () => void) {
    if (!native) return () => {};
    const sub = new NativeEventEmitter(
      NativeModules.NovaHomeWidget,
    ).addListener('NovaNetworkAvailable', listener);
    return () => sub.remove();
  },
};
