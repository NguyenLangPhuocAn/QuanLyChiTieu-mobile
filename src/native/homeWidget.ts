import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
const native = NativeModules.NovaHomeWidget as
  | {
      activate(scope: string | null): Promise<void>;
      update(scope: string, json: string): Promise<void>;
      requestPin(): Promise<boolean>;
      isConnected(): Promise<boolean>;
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
  requestPin: () => native?.requestPin() ?? Promise.resolve(false),
  connected: () => native?.isConnected() ?? Promise.resolve(true),
  subscribe(listener: () => void) {
    if (!native) return () => {};
    const sub = new NativeEventEmitter(
      NativeModules.NovaHomeWidget,
    ).addListener('NovaNetworkAvailable', listener);
    return () => sub.remove();
  },
};
