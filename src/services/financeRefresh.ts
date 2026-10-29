const listeners = new Set<() => void>();
export const financeRefresh = {
  emit() {
    listeners.forEach(listener => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
