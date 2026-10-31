import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ActionButton } from './FormControls';
import {
  planningLocalStore,
  type PlanningScope,
  type PlanningLocalState,
} from '../services/planningLocalStore';
import {
  planningSync,
  type PlanningSyncPreview,
} from '../services/planningSync';
import { snapshotKey, snapshotOf } from '../services/planningSnapshot';
import { getUserFriendlyErrorMessage } from '../utils/errors';
import { formatCurrency } from '../utils/format';
import type { PlanningSnapshot } from '../services/planningSnapshot';

export default function PlanningSyncControls({
  scope,
}: {
  scope: PlanningScope;
}) {
  const { token } = useAuth();
  const [status, setStatus] = useState<PlanningLocalState['sync'] | null>(null);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<PlanningSyncPreview | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(false);
  const live = useRef(false),
    generation = useRef(0),
    running = useRef(false);
  const latest = useRef(scope);
  const { userId, server } = scope;
  latest.current = scope;
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        generation.current++;
        setPreview(null);
      }
    });
    return () => sub.remove();
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      live.current = true;
      return () => {
        live.current = false;
        generation.current++;
      };
    }, []),
  );
  useEffect(() => {
    let active = true;
    const selected = { userId, server };
    const load = () =>
      planningLocalStore
        .read(selected)
        .then(state => {
          if (active) {
            setStatus(state.sync);
            setPending(snapshotKey(snapshotOf(state)) !== state.sync.baseline);
          }
        })
        .catch(() => undefined);
    load();
    const stop = planningLocalStore.subscribe(changed => {
      if (changed.userId === userId && changed.server === server)
        load();
    });
    setPreview(null);
    generation.current++;
    return () => {
      active = false;
      stop();
    };
  }, [userId, server]);
  const operate = async (
    operation: (current: () => boolean) => Promise<void>,
  ) => {
    if (running.current || !live.current || !token) return;
    running.current = true;
    setBusy(true);
    setMessage('');
    const rev = generation.current;
    const current = () =>
      live.current &&
      generation.current === rev &&
      latest.current.userId === scope.userId &&
      latest.current.server === scope.server;
    try {
      await operation(current);
    } catch (e) {
      if (current())
        setMessage(
          getUserFriendlyErrorMessage(
            e,
            'Chưa đồng bộ được. Lịch trên máy được giữ nguyên.',
          ),
        );
    } finally {
      running.current = false;
      if (live.current) setBusy(false);
    }
  };
  const read = () => {
    generation.current++;
    setPreview(null);
    setExpanded(false);
    operate(async current => {
      const value = await planningSync.preview(scope, token!);
      if (current()) setPreview(value);
    });
  };
  const confirm = (source: 'local' | 'cloud') => {
    if (!preview) return;
    const chosen = preview,
      rev = generation.current;
    Alert.alert(
      source === 'local'
        ? 'Dùng bản lịch trên máy?'
        : 'Nhận bản lịch từ tài khoản?',
      source === 'local'
        ? 'Bản trên máy sẽ thay bản lịch trên tài khoản. Các thiết bị đã bật đồng bộ sẽ nhận bản này. Không tạo giao dịch hoặc đổi số dư.'
        : 'Bản tài khoản sẽ thay lịch hóa đơn và khoản dự kiến trên máy. Lịch mới nhận chưa tự bật nhắc. Không tạo giao dịch hoặc đổi số dư.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận đồng bộ',
          onPress: () => {
            if (!live.current || generation.current !== rev) return;
            operate(async current => {
              await planningSync.confirm(
                scope,
                token!,
                chosen,
                source,
                current,
              );
              if (current()) {
                setPreview(null);
                setMessage(
                  'Đã bật đồng bộ lịch. Khi app có mạng, các thay đổi tiếp theo được đồng bộ tự động.',
                );
              }
            });
          },
        },
      ],
    );
  };
  const details = (snapshot: PlanningSnapshot) => {
    const rows = [
      ...snapshot.book.bills.map(b => ({
        key: `bill:${b.id}`,
        text: `${b.label} · ${formatCurrency(b.maxAmount, b.currency)} · ${
          b.archived ? 'Đã lưu trữ' : b.paused ? 'Tạm dừng' : 'Lịch định kỳ'
        }`,
      })),
      ...snapshot.plans.map(p => ({
        key: `plan:${p.id}`,
        text: `${p.label} · ${p.type === 'INCOME' ? '+' : '−'}${formatCurrency(
          p.amount,
          p.currency,
        )} · ${p.date.split('-').reverse().join('/')}`,
      })),
    ];
    return (expanded ? rows : rows.slice(0, 5)).map(row => (
      <Text key={row.key} style={styles.detail}>
        {row.text}
      </Text>
    ));
  };
  return (
    <View style={styles.box}>
      <ActionButton
        label={
          status?.conflict
            ? 'Chọn bản lịch cần giữ'
            : 'Đồng bộ lịch giữa thiết bị'
        }
        secondary
        disabled={busy || !token}
        onPress={read}
      />
      <Text style={styles.text}>
        {status?.conflict
          ? 'Hai thiết bị cùng sửa. Dữ liệu được giữ lại để bạn chọn.'
          : status?.enabled
          ? pending
            ? 'Có thay đổi đang chờ đồng bộ. Giữ trên máy khi mất mạng.'
            : 'Đã đồng bộ lịch. Tự cập nhật khi app đang mở và có mạng.'
          : 'Lịch hóa đơn và khoản dự kiến hiện lưu trên máy. Bật đồng bộ để dùng chung giữa thiết bị.'}
      </Text>
      {preview && (
        <View style={styles.preview}>
          <Text style={styles.title}>
            Trên máy: {preview.local.book.bills.length} lịch ·{' '}
            {preview.local.plans.length} khoản dự kiến.
          </Text>
          {details(preview.local)}
          <Text style={styles.title}>
            Tài khoản: {preview.cloud.snapshot?.book.bills.length ?? 0} lịch ·{' '}
            {preview.cloud.snapshot?.plans.length ?? 0} khoản dự kiến.
          </Text>
          {preview.cloud.snapshot && details(preview.cloud.snapshot)}
          {!expanded &&
            (preview.local.book.bills.length + preview.local.plans.length > 5 ||
              (preview.cloud.snapshot?.book.bills.length ?? 0) +
                (preview.cloud.snapshot?.plans.length ?? 0) >
                5) && (
              <ActionButton
                label="Xem toàn bộ nội dung hai bản"
                secondary
                onPress={() => setExpanded(true)}
              />
            )}
          {preview.cloud.snapshot && (
            <ActionButton
              label="Nhận bản từ tài khoản"
              onPress={() => confirm('cloud')}
              disabled={busy}
            />
          )}
          <ActionButton
            label={
              preview.cloud.snapshot
                ? 'Giữ bản trên máy'
                : 'Bật đồng bộ bản trên máy'
            }
            onPress={() => confirm('local')}
            secondary={!!preview.cloud.snapshot}
            disabled={busy}
          />
          <ActionButton
            label="Đóng xem trước đồng bộ"
            secondary
            disabled={busy}
            onPress={() => {
              generation.current++;
              setPreview(null);
            }}
          />
        </View>
      )}
      {status?.enabled && (
        <ActionButton
          label="Tắt tự đồng bộ lịch"
          secondary
          disabled={busy}
          onPress={() =>
            operate(async () => {
              await planningSync.disable(scope);
              setPreview(null);
            })
          }
        />
      )}
      {busy && <Text accessibilityRole="progressbar">Đang kiểm tra lịch…</Text>}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {message}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    gap: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1D4B9',
    borderRadius: 16,
    backgroundColor: '#FFF6ED',
  },
  text: { color: '#886449', lineHeight: 21, fontSize: 13 },
  title: { color: '#593420', fontWeight: '700', fontSize: 14, marginTop: 6 },
  detail: { color: '#886449', fontSize: 13, lineHeight: 20 },
  preview: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#F1D4B9',
  },
});
