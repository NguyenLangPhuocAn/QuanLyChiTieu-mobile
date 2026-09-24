import { useCallback, useEffect, useRef, useState } from 'react';

/** Acquire synchronously so two taps in the same render cannot both submit. */
export const useSingleFlight = () => {
  const locked = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T | undefined> => {
      if (locked.current || !mounted.current) return undefined;
      locked.current = true;
      setBusy(true);
      try {
        return await operation();
      } finally {
        locked.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [],
  );
  return { run, busy };
};
