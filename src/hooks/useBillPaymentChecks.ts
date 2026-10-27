import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';
import { checkPaymentLinks } from '../services/billPaymentChecks';
import {
  paymentTargetKey,
  type BillPaymentCheck,
  type BillPaymentTarget,
} from '../utils/billPaymentChecks';
import type { BillBook } from '../utils/recurringBills';

export function useBillPaymentChecks(
  book: BillBook | null,
  token: string,
  enabled: boolean,
) {
  const targets = useMemo(() => {
    const result: BillPaymentTarget[] = [];
    for (const period of book?.periods ?? []) {
      const bill = book?.bills.find(b => b.id === period.billId);
      if (bill && period.status === 'PAID') result.push({ bill, period });
    }
    return result;
  }, [book]);
  const signature = targets.map(paymentTargetKey).join('|');
  const revision = useRef(0);
  const live = useRef(false);
  const foreground = useRef(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  const running = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Record<string, BillPaymentCheck>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      foreground.current = state === 'active';
      if (!foreground.current) {
        revision.current += 1;
        running.current = false;
        setLoading(false);
        setResults({});
        setError(null);
      }
    });
    return () => listener.remove();
  }, []);
  useFocusEffect(
    useCallback(() => {
      live.current = true;
      // A result from a previous visit is not a new server verification.
      setResults({});
      setLoading(false);
      running.current = false;
      return () => {
        live.current = false;
        running.current = false;
        revision.current += 1;
      };
    }, []),
  );
  useEffect(() => {
    revision.current += 1;
    running.current = false;
    setLoading(false);
    setResults({});
    setError(null);
  }, [signature, enabled]);
  const capture = () => {
    const request = revision.current;
    return () =>
      live.current &&
      foreground.current &&
      enabledRef.current &&
      request === revision.current;
  };
  const cancel = () => {
    revision.current += 1;
    running.current = false;
    setLoading(false);
    setError('Đã dừng kiểm tra. Các liên kết được giữ nguyên.');
  };
  const check = async () => {
    if (
      !live.current ||
      !foreground.current ||
      !enabled ||
      running.current ||
      !targets.length
    )
      return;
    running.current = true;
    revision.current += 1;
    const current = capture();
    setLoading(true);
    setProgress(0);
    setResults({});
    setError(null);
    try {
      const checked = await checkPaymentLinks(
        token,
        targets,
        current,
        count => {
          if (current()) setProgress(count);
        },
      );
      if (current()) setResults(checked);
    } catch {
      if (current())
        setError(
          'Chưa đối chiếu được với máy chủ. Không kết luận giao dịch đã xóa; liên kết được giữ nguyên. Hãy kiểm tra mạng hoặc phiên bản máy chủ rồi thử lại.',
        );
    } finally {
      if (current()) {
        running.current = false;
        setLoading(false);
      }
    }
  };
  return { targets, results, error, loading, progress, check, cancel, capture };
}
