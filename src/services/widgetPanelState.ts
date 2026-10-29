import { useSyncExternalStore } from 'react';
let open = false;
const listeners = new Set<() => void>();
export const widgetPanelState = {
  set(value: boolean) {
    open = value;
    listeners.forEach(listener => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  snapshot: () => open,
};
export const useWidgetPanelOpen = () =>
  useSyncExternalStore(widgetPanelState.subscribe, widgetPanelState.snapshot);
