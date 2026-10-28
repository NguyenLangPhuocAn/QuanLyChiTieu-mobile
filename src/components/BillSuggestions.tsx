import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BillActivityFindings from './BillActivityFindings';
import { ActionButton } from './FormControls';
import { loadBillSuggestionHistory } from '../services/billSuggestionHistory';
import {
  recurringBillsService,
  type BillScope,
} from '../services/recurringBills';
import { billDateOffset, type BillBook } from '../utils/recurringBills';
import {
  suggestBills,
  suggestionVisibility,
  type BillSuggestion,
} from '../utils/billSuggestions';
import { formatCurrency } from '../utils/format';

type Props = {
  scope: BillScope;
  token: string;
  today: string;
  book: BillBook;
  hidden: boolean;
  onFollow: (suggestion: BillSuggestion) => void;
  onBookChange: () => Promise<void>;
};
const cycleNames = {
  WEEKLY: 'Hằng tuần',
  MONTHLY: 'Hằng tháng',
  YEARLY: 'Hằng năm',
};
const dateLabel = (date: string) => date.split('-').reverse().join('/');
export default function BillSuggestions({
  scope,
  token,
  today,
  book,
  hidden,
  onFollow,
  onBookChange,
}: Props) {
  const trackedCount =
    book.suggestions?.filter(item => item.status === 'TRACKED').length ?? 0;
  const [shownTrackedCount, setShownTrackedCount] = useState(trackedCount);
  const [history, setHistory] =
    useState<Awaited<ReturnType<typeof loadBillSuggestionHistory>>>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(5);
  const [showHidden, setShowHidden] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const working = useRef(false);
  const searching = useRef(false);
  const live = useRef(true);
  const foreground = useRef(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  const generation = useRef(0);
  useFocusEffect(
    useCallback(() => {
      live.current = true;
      searching.current = false;
      setLoading(false);
      setHistory(null);
      setError(null);
      return () => {
        live.current = false;
        generation.current += 1;
      };
    }, []),
  );
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      foreground.current = state === 'active';
      if (!foreground.current) {
        generation.current += 1;
        searching.current = false;
        setLoading(false);
        setHistory(null);
        setError(null);
      }
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (hidden) {
      searching.current = false;
      generation.current += 1;
      setLoading(false);
    }
  }, [hidden]);
  const candidates = useMemo(
    () => (history ? suggestBills(history.rows, today) : []),
    [history, today],
  );
  const visible = candidates.filter(
    item => suggestionVisibility(item, book, today) === 'VISIBLE',
  );
  const suppressed = candidates.filter(
    item => suggestionVisibility(item, book, today) === 'HIDDEN',
  );
  const search = async () => {
    if (searching.current || !live.current || !foreground.current) return;
    searching.current = true;
    const request = ++generation.current;
    const current = () =>
      live.current && foreground.current && request === generation.current;
    setLoading(true);
    setError(null);
    setHistory(null);
    setCount(5);
    try {
      const result = await loadBillSuggestionHistory(token, today, current);
      if (current()) {
        setHistory(result);
        setShownTrackedCount(trackedCount);
      }
    } catch (reason) {
      if (current())
        setError(
          reason instanceof Error
            ? reason.message
            : 'Chưa kiểm tra được giao dịch. Hãy thử lại.',
        );
    } finally {
      if (current()) {
        searching.current = false;
        setLoading(false);
      }
    }
  };
  const decide = async (
    candidate: BillSuggestion,
    status: 'IGNORED' | 'LATER' | 'RESTORE',
  ) => {
    if (working.current) return;
    working.current = true;
    setSaving(true);
    setError(null);
    try {
      if (status === 'RESTORE')
        await recurringBillsService.restoreSuggestion(scope, candidate.key);
      else
        await recurringBillsService.decideSuggestion(
          scope,
          candidate.key,
          status,
          status === 'LATER' ? billDateOffset(today, 7) : undefined,
        );
      if (live.current) await onBookChange();
    } catch (reason) {
      if (live.current)
        setError(
          reason instanceof Error ? reason.message : 'Chưa lưu được lựa chọn.',
        );
    } finally {
      working.current = false;
      if (live.current) setSaving(false);
    }
  };
  const renderGeneration = generation.current;
  if (hidden) return null;
  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <Text style={styles.title}>Kiểm tra khoản định kỳ</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={loading ? 'Dừng tìm khoản lặp' : 'Tìm khoản lặp'}
          disabled={saving}
          style={styles.linkButton}
          onPress={() => {
            if (loading) {
              searching.current = false;
              generation.current += 1;
              setLoading(false);
              setError('Đã dừng kiểm tra. Bạn có thể tìm lại.');
            } else search();
          }}
        >
          <Text style={styles.link}>
            {loading ? 'Dừng' : history ? 'Kiểm tra lại' : 'Kiểm tra'}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.detail}>
        {loading
          ? 'Đang kiểm tra các khoản chi trong 3 năm gần đây…'
          : 'Gợi ý từ lịch sử, chỉ tạo lịch sau khi bạn xác nhận.'}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {history ? (
        <>
          <Text style={styles.detail}>
            Đã kiểm tra {history.rows.length}/{history.total} khoản chi trong 3
            năm.
            {!history.complete
              ? ' Lịch sử chưa tải hết (giới hạn 2.000 khoản); gợi ý chỉ dựa trên phần đã tải.'
              : ''}
          </Text>
          {trackedCount !== shownTrackedCount ? (
            <ActionButton
              label="Xem kết quả đã kiểm tra"
              secondary
              onPress={() => setShownTrackedCount(trackedCount)}
            />
          ) : (
            <>
              <BillActivityFindings
                key={renderGeneration}
                book={book}
                rows={history.rows}
                today={today}
                scope={scope}
                onBookChange={onBookChange}
                isCurrent={() =>
                  live.current &&
                  foreground.current &&
                  !hidden &&
                  renderGeneration === generation.current
                }
              />
              {!visible.length ? (
                <Text style={styles.detail}>
                  {candidates.length
                    ? 'Không còn gợi ý mới trong lần kiểm tra này.'
                    : 'Chưa tìm được khoản lặp có ít nhất 3 lần chi trong phần dữ liệu đã kiểm tra. Bạn vẫn có thể tự thêm lịch.'}
                </Text>
              ) : null}
              {visible.slice(0, count).map(candidate => (
                <View key={candidate.key} style={styles.card}>
                  <Text style={styles.title}>{candidate.input.label}</Text>
                  <Text style={styles.detail}>
                    {cycleNames[candidate.input.cycle]} ·{' '}
                    {candidate.evidence.length} lần chi · Dự kiến{' '}
                    {dateLabel(candidate.nextDate)}
                  </Text>
                  <Text style={styles.amount}>
                    {formatCurrency(
                      candidate.input.minAmount,
                      candidate.input.currency,
                    )}
                    {candidate.input.kind === 'VARIABLE'
                      ? ` – ${formatCurrency(
                          candidate.input.maxAmount,
                          candidate.input.currency,
                        )}`
                      : ''}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Xem bằng chứng ${candidate.input.label}`}
                    style={styles.linkButton}
                    onPress={() =>
                      setExpanded(value => ({
                        ...value,
                        [candidate.key]: value[candidate.key] ? 0 : 6,
                      }))
                    }
                  >
                    <Text style={styles.link}>
                      {expanded[candidate.key]
                        ? 'Thu gọn bằng chứng'
                        : `Xem ${candidate.evidence.length} lần chi`}
                    </Text>
                  </TouchableOpacity>
                  {expanded[candidate.key] ? (
                    <View style={styles.evidence}>
                      {candidate.evidence
                        .slice(-expanded[candidate.key])
                        .reverse()
                        .map(item => (
                          <View
                            key={item.id}
                            style={styles.evidenceEntry}
                            accessible
                            accessibilityLabel={`Giao dịch ${
                              item.id
                            }, ${dateLabel(item.date)}, ${formatCurrency(
                              item.amount,
                              candidate.input.currency,
                            )}, ${item.note}`}
                          >
                            <View style={styles.row}>
                              <Text style={styles.detail}>
                                {dateLabel(item.date)} · #{item.id}
                              </Text>
                              <Text style={styles.value}>
                                {formatCurrency(
                                  item.amount,
                                  candidate.input.currency,
                                )}
                              </Text>
                            </View>
                            <Text style={styles.detail}>{item.note}</Text>
                          </View>
                        ))}
                      {expanded[candidate.key] < candidate.evidence.length ? (
                        <ActionButton
                          label="Xem thêm bằng chứng"
                          secondary
                          onPress={() =>
                            setExpanded(value => ({
                              ...value,
                              [candidate.key]: value[candidate.key] + 6,
                            }))
                          }
                        />
                      ) : null}
                    </View>
                  ) : null}
                  <ActionButton
                    label="Theo dõi"
                    accessibilityLabel={`Theo dõi ${candidate.input.label}`}
                    disabled={saving}
                    onPress={() => onFollow(candidate)}
                  />
                  <View style={styles.row}>
                    <View style={styles.grow}>
                      <ActionButton
                        label="Không định kỳ"
                        accessibilityLabel={`Không phải định kỳ ${candidate.input.label}`}
                        secondary
                        disabled={saving}
                        onPress={() => decide(candidate, 'IGNORED')}
                      />
                    </View>
                    <View style={styles.grow}>
                      <ActionButton
                        label="Để sau 7 ngày"
                        accessibilityLabel={`Để sau ${candidate.input.label}`}
                        secondary
                        disabled={saving}
                        onPress={() => decide(candidate, 'LATER')}
                      />
                    </View>
                  </View>
                </View>
              ))}
              {visible.length > count ? (
                <ActionButton
                  label="Xem thêm gợi ý"
                  secondary
                  onPress={() => setCount(count + 5)}
                />
              ) : null}
              {suppressed.length ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Xem gợi ý đã ẩn"
                  style={styles.linkButton}
                  onPress={() => setShowHidden(!showHidden)}
                >
                  <Text style={styles.link}>
                    {showHidden ? 'Thu gọn' : 'Đã ẩn'} ({suppressed.length})
                  </Text>
                </TouchableOpacity>
              ) : null}
              {showHidden
                ? suppressed.map(candidate => (
                    <View key={candidate.key} style={styles.card}>
                      <Text style={styles.title}>{candidate.input.label}</Text>
                      <Text style={styles.detail}>
                        {book.suggestions?.find(
                          item => item.key === candidate.key,
                        )?.status === 'IGNORED'
                          ? 'Đã chọn không phải định kỳ.'
                          : 'Tạm ẩn trong 7 ngày.'}
                      </Text>
                      <ActionButton
                        label="Hiện lại"
                        accessibilityLabel={`Hiện lại ${candidate.input.label}`}
                        secondary
                        disabled={saving}
                        onPress={() => decide(candidate, 'RESTORE')}
                      />
                    </View>
                  ))
                : null}
            </>
          )}
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  section: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0D4BD',
    backgroundColor: '#FFF8F0',
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F0D4BD',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  grow: { flex: 1, minWidth: 120 },
  title: { fontSize: 16, fontWeight: '700', color: '#593420', flexShrink: 1 },
  detail: { fontSize: 13, lineHeight: 20, color: '#8A6042', flexShrink: 1 },
  amount: { fontSize: 17, fontWeight: '700', color: '#AA4F0A' },
  value: { color: '#593420', fontSize: 13, fontWeight: '600' },
  linkButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  link: { color: '#AA4F0A', fontWeight: '700', fontSize: 13 },
  evidence: { gap: 8, paddingVertical: 8 },
  evidenceEntry: { gap: 4, paddingVertical: 6 },
  error: { color: '#B44224', fontSize: 13, lineHeight: 20 },
});
