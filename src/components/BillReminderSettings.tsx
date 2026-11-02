import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { billReminder, type BillReminderState } from '../native/billReminder';
import { requestFinancialReminderPermission } from '../native/financialReminder';
import { billReminderSession } from '../services/billReminderSession';
import type { BillScope } from '../services/recurringBills';
import type { BillBook } from '../utils/recurringBills';

export default function BillReminderSettings({
  scope,
  book,
}: {
  scope: BillScope;
  book: BillBook;
}) {
  const [state, setState] = useState<BillReminderState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    // Refresh the native mirror after this persisted book changes, including paid/skipped periods.
    if (book.version !== 1) throw new Error('Lịch hóa đơn chưa hợp lệ.');
    await billReminderSession.sync(scope);
    return billReminder.state(scope);
  }, [scope, book]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (billReminder.isSupported)
        load()
          .then(value => {
            if (active) {
              setState(value);
              setError(null);
            }
          })
          .catch(() => {
            if (active) setError('Chưa cập nhật được lịch nhắc. Thử lại.');
          });
      return () => {
        active = false;
      };
    }, [load]),
  );
  const save = async (enabled: boolean, hour: number, minute: number) => {
    if (busy) return;
    setBusy(true);
    try {
      if (enabled && !(await requestFinancialReminderPermission())) {
        setError('Chưa có quyền thông báo. Bạn vẫn xem lịch trong ứng dụng.');
        return;
      }
      await billReminderSession.sync(scope);
      const value = await billReminder.save(scope, enabled, hour, minute);
      setState(value);
      setError(null);
    } catch {
      setError('Chưa lưu được lời nhắc. Kiểm tra quyền thông báo và thử lại.');
    } finally {
      setBusy(false);
    }
  };
  if (!billReminder.isSupported)
    return (
      <Text style={styles.detail}>
        Nhắc ngoài app cần bản Android hỗ trợ tính năng này.
      </Text>
    );
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Text style={styles.title}>Nhắc hóa đơn</Text>
          <Text style={styles.detail}>
            Trước 3 ngày, 1 ngày và đúng hạn. Các khoản cùng ngày được gộp lại.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Bật nhắc hóa đơn"
          disabled={busy || !state}
          value={state?.enabled ?? false}
          trackColor={{ false: '#D5D0CA', true: '#73A481' }}
          thumbColor="#FFFFFF"
          onValueChange={enabled =>
            save(enabled, state?.hour ?? 20, state?.minute ?? 0)
          }
        />
      </View>
      {state?.enabled ? (
        <Text style={styles.detail}>
          {!state.permissionGranted
            ? 'Thông báo đang bị chặn trong Cài đặt Android.'
            : !state.synced
            ? 'Lịch nhắc chưa cập nhật. Hãy thử lại.'
            : state.nextAt
            ? `Ngày nhắc tới: ${new Date(state.nextAt).toLocaleDateString(
                'vi-VN',
              )}`
            : 'Chưa có kỳ cần nhắc sắp tới.'}
        </Text>
      ) : null}
      {error ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Thử đồng bộ nhắc hóa đơn"
          onPress={() =>
            load()
              .then(value => {
                setState(value);
                setError(null);
              })
              .catch(() =>
                Alert.alert('Chưa tải được', 'Hãy mở lại màn hình và thử lại.'),
              )
          }
        >
          <Text style={styles.error}>{error}</Text>
        </TouchableOpacity>
      ) : null}
      {error || (state?.enabled && !state.permissionGranted) ? (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.link}>Mở cài đặt thông báo</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#F0DCCB',
    backgroundColor: '#FFF8F1',
    padding: 16,
    borderRadius: 18,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  title: { color: '#54321F', fontSize: 15, fontWeight: '700' },
  detail: { color: '#8C654D', fontSize: 13, lineHeight: 20 },
  error: { color: '#BA3527', lineHeight: 20 },
  link: {
    color: '#AB570F',
    minHeight: 44,
    textAlignVertical: 'center',
    fontWeight: '700',
  },
});
