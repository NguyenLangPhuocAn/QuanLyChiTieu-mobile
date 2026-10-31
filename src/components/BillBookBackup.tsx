import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ActionButton } from './FormControls';
import {
  localDocumentPicker,
  type PickedDocument,
} from '../native/documentPicker';
import {
  billBookBackupService,
  type BillBackupPreview,
} from '../services/billBookBackup';
import type { BillScope } from '../services/recurringBills';
import { getUserFriendlyErrorMessage } from '../utils/errors';
import { formatCurrency } from '../utils/format';
export default function BillBookBackup({
  scope,
  onRestored,
}: {
  scope: BillScope;
  onRestored: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [file, setFile] = useState<PickedDocument | null>(null);
  const [preview, setPreview] = useState<BillBackupPreview | null>(null),
    [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null),
    [visible, setVisible] = useState(5);
  const alive = useRef(false),
    revision = useRef(0),
    working = useRef(false),
    nativePicker = useRef(false);
  const latest = useRef(scope);
  latest.current = scope;
  const invalidate = useCallback(() => {
    revision.current += 1;
    setPreview(null);
    setMessage(null);
  }, []);
  useEffect(() => {
    invalidate();
    setFile(null);
    setOpen(false);
  }, [scope.userId, scope.server, invalidate]);
  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      return () => {
        alive.current = false;
        revision.current += 1;
      };
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active' && !nativePicker.current) invalidate();
    });
    return () => sub.remove();
  }, [invalidate]);
  const operate = async (
    label: string,
    operation: (current: () => boolean) => Promise<void>,
  ) => {
    if (working.current || !alive.current) return;
    working.current = true;
    setBusy(label);
    setMessage(null);
    const rev = revision.current,
      current = () =>
        alive.current &&
        revision.current === rev &&
        latest.current.userId === scope.userId &&
        latest.current.server === scope.server;
    try {
      await operation(current);
    } catch (reason) {
      if (current())
        setMessage(
          getUserFriendlyErrorMessage(
            reason,
            'Chưa thực hiện được. Giữ nguyên lịch trên máy và thử lại.',
          ),
        );
    } finally {
      working.current = false;
      if (alive.current) setBusy(null);
    }
  };
  const exportFile = () =>
    operate('Đang tạo file', async current => {
      const result = await billBookBackupService.export(scope);
      if (!current()) return;
      nativePicker.current = true;
      let saved;
      try {
        saved = await localDocumentPicker.saveBase64File(
          result.filename,
          result.mimeType,
          result.base64,
        );
      } finally {
        nativePicker.current = false;
      }
      if (current() && saved) {
        setPreview(null);
        setMessage(`Đã lưu ${saved.name}.`);
      }
    });
  const choose = () => {
    invalidate();
    operate('Đang đọc file', async current => {
      nativePicker.current = true;
      let picked;
      try {
        picked = await localDocumentPicker.pickBackupFile();
      } finally {
        nativePicker.current = false;
      }
      if (!current() || !picked) return;
      setFile(picked);
      const result = await billBookBackupService.preview(scope, picked);
      if (current()) {
        setPreview(result);
        setVisible(5);
      }
    });
  };
  const restore = () => {
    if (!preview || !file || working.current) return;
    const rev = revision.current,
      chosen = preview;
    Alert.alert(
      'Thay lịch trên máy bằng bản sao lưu?',
      `${chosen.book.bills.length} lịch và ${
        chosen.book.periods.length
      } kỳ đã xử lý sẽ thay toàn bộ lịch hiện tại. ${
        chosen.plans === null
          ? 'Giữ nguyên các khoản dự kiến đang có.'
          : `Thay các khoản dự kiến bằng ${chosen.plans.length} khoản trong file.`
      } Không tạo giao dịch hoặc đổi số dư. Nhắc từng lịch được tắt; các liên kết cũ cần kiểm tra lại nguồn.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Khôi phục lịch',
          onPress: () => {
            if (revision.current !== rev || !alive.current) return;
            operate('Đang khôi phục', async current => {
              await billBookBackupService.restore(scope, file, chosen, current);
              if (!current()) return;
              setPreview(null);
              setFile(null);
              setMessage(
                'Đã khôi phục lịch. Nhắc từng lịch đang tắt; hãy kiểm tra liên kết trước khi bật nhắc lại.',
              );
              await onRestored();
            });
          },
        },
      ],
    );
  };
  return (
    <View style={styles.box}>
      <ActionButton
        label={open ? 'Đóng sao lưu lịch' : 'Sao lưu và khôi phục lịch'}
        secondary
        onPress={() => {
          invalidate();
          setOpen(!open);
        }}
        disabled={!!busy}
      />
      {open ? (
        <>
          <Text style={styles.title}>Sao lưu lịch và khoản dự kiến</Text>
          <Text style={styles.text}>
            File thường, không cần mật khẩu. Lưu và khôi phục ngay trên máy,
            không cần mạng. Gồm lịch hóa đơn và thu/chi dự kiến. Chọn file sẽ tự
            hiện bản xem trước.
          </Text>
          <ActionButton
            label="Lưu file lịch"
            onPress={exportFile}
            disabled={!!busy}
          />
          <ActionButton
            label={file ? `File: ${file.name}` : 'Chọn file lịch để khôi phục'}
            accessibilityLabel="Chọn file sao lưu lịch"
            onPress={choose}
            secondary
            disabled={!!busy}
          />
          {preview ? (
            <View style={styles.preview}>
              <Text style={styles.title}>
                Bản sao{' '}
                {preview.createdAt.slice(0, 10).split('-').reverse().join('/')}
              </Text>
              <Text style={styles.text}>
                Trên máy hiện có {preview.currentCount.bills} lịch ·{' '}
                {preview.currentCount.periods} kỳ đã xử lý ·{' '}
                {preview.currentPlanCount} khoản dự kiến.
              </Text>
              <Text style={styles.text}>
                {preview.book.bills.length} lịch ·{' '}
                {preview.book.periods.filter(p => p.status === 'PAID').length}{' '}
                kỳ liên kết ·{' '}
                {
                  preview.book.periods.filter(p => p.status === 'SKIPPED')
                    .length
                }{' '}
                kỳ bỏ qua ·{' '}
                {preview.plans === null
                  ? 'giữ khoản dự kiến trên máy'
                  : preview.plans.length + ' khoản dự kiến trong file'}
              </Text>
              {preview.book.bills.slice(0, visible).map(b => (
                <Text key={b.id} style={styles.text}>
                  {b.label} · {formatCurrency(b.minAmount, b.currency)}
                  {b.minAmount !== b.maxAmount
                    ? ` – ${formatCurrency(b.maxAmount, b.currency)}`
                    : ''}
                </Text>
              ))}
              {preview.book.bills.length > visible ? (
                <ActionButton
                  label={`Xem thêm ${Math.min(
                    20,
                    preview.book.bills.length - visible,
                  )} lịch trong file`}
                  secondary
                  onPress={() => setVisible(n => n + 20)}
                />
              ) : null}
              {!!preview.plans?.length && (
                <>
                  <Text style={styles.title}>Khoản dự kiến trong file</Text>
                  {preview.plans.slice(0, visible).map(plan => (
                    <Text key={plan.id} style={styles.text}>
                      {plan.label} · {plan.type === 'INCOME' ? '+' : '−'}
                      {formatCurrency(plan.amount, plan.currency)} ·{' '}
                      {plan.date.split('-').reverse().join('/')}
                    </Text>
                  ))}
                  {preview.plans.length > visible && (
                    <ActionButton
                      label={`Xem thêm ${Math.min(
                        20,
                        preview.plans.length - visible,
                      )} khoản dự kiến`}
                      secondary
                      onPress={() => setVisible(n => n + 20)}
                    />
                  )}
                </>
              )}
              <Text style={styles.text}>
                Thay toàn bộ lịch hiện tại, không cộng dồn hoặc tạo giao dịch.
                Tắt nhắc từng lịch sau khôi phục. File không chứa ảnh hoặc toàn
                bộ giao dịch.
              </Text>
              <ActionButton
                label="Khôi phục lịch từ file"
                onPress={restore}
                disabled={!!busy}
              />
            </View>
          ) : null}
          {busy ? (
            <Text accessibilityRole="progressbar" style={styles.text}>
              {busy}…
            </Text>
          ) : null}
          {message ? (
            <Text accessibilityLiveRegion="polite" style={styles.text}>
              {message}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1D4B9',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFF6ED',
  },
  preview: {
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#F1D4B9',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#593420' },
  text: { fontSize: 13, lineHeight: 20, color: '#886449' },
});
