import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';

// Android can host the main app and widget panel in two React roots in one JS runtime.
// Elect exactly one session controller so token refresh/logout callbacks cannot compete.
export function createSharedProvider<T>(
  Context: React.Context<T | undefined>,
  Controller: React.ComponentType<
    React.PropsWithChildren<{ publish: (value: T) => void }>
  >,
) {
  const hosts = new Set<object>();
  const ownerListeners = new Set<() => void>();
  const valueListeners = new Set<() => void>();
  let owner: object | undefined;
  let value: T | undefined;
  const subscribeOwner = (listener: () => void) => {
    ownerListeners.add(listener);
    return () => {
      ownerListeners.delete(listener);
    };
  };
  const subscribeValue = (listener: () => void) => {
    valueListeners.add(listener);
    return () => {
      valueListeners.delete(listener);
    };
  };
  const publish = (next: T) => {
    value = next;
    valueListeners.forEach(listener => listener());
  };
  function Follower({ children }: React.PropsWithChildren) {
    const snapshot = useSyncExternalStore(subscribeValue, () => value);
    return snapshot === undefined ? null : (
      <Context.Provider value={snapshot}>{children}</Context.Provider>
    );
  }
  return function SharedProvider({ children }: React.PropsWithChildren) {
    const host = useRef({}).current;
    const currentOwner = useSyncExternalStore(subscribeOwner, () => owner);
    useLayoutEffect(() => {
      hosts.add(host);
      if (!owner) {
        owner = host;
        ownerListeners.forEach(listener => listener());
      }
      return () => {
        hosts.delete(host);
        if (owner === host) {
          value = undefined;
          owner = hosts.values().next().value;
          ownerListeners.forEach(listener => listener());
          valueListeners.forEach(listener => listener());
        }
      };
    }, [host]);
    return currentOwner === host ? (
      <Controller publish={publish}>{children}</Controller>
    ) : (
      <Follower>{children}</Follower>
    );
  };
}
