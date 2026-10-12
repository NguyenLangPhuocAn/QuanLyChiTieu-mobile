import React, { PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Download, ShieldCheck } from 'lucide-react-native';

import { Colors } from '../constants/Colors';
import {
  appUpdateService,
  type AppUpdateManifest,
} from '../services/appUpdate';

const AppUpdateManager = ({ children }: PropsWithChildren) => {
  const [manifest, setManifest] = useState<AppUpdateManifest | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const waitingForPermission = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!appUpdateService.isSupported()) return () => undefined;

    const timer = setTimeout(() => {
      appUpdateService
        .check()
        .then(update => {
          if (mounted.current && update) setManifest(update);
        })
        .catch(() => undefined);
    }, 1_500);

    return () => {
      mounted.current = false;
      clearTimeout(timer);
    };
  }, []);

  const downloadAndInstall = useCallback(async (update: AppUpdateManifest) => {
    setDownloading(true);
    setProgress(0);
    setError('');
    try {
      const filePath = await appUpdateService.download(update, value => {
        if (mounted.current) setProgress(value);
      });
      await appUpdateService.install(filePath);
    } catch (downloadError) {
      if (mounted.current) {
        setError(
          downloadError instanceof Error
            ? downloadError.message
            : 'Không thể cài bản cập nhật.',
        );
      }
    } finally {
      if (mounted.current) setDownloading(false);
    }
  }, []);

  const beginUpdate = useCallback(async () => {
    if (!manifest || downloading) return;
    setError('');
    try {
      if (!(await appUpdateService.canInstallPackages())) {
        waitingForPermission.current = true;
        await appUpdateService.openInstallPermission();
        return;
      }
      await downloadAndInstall(manifest);
    } catch (permissionError) {
      setError(
        permissionError instanceof Error
          ? permissionError.message
          : 'Không mở được quyền cài đặt.',
      );
    }
  }, [downloadAndInstall, downloading, manifest]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async state => {
      if (
        state !== 'active' ||
        !waitingForPermission.current ||
        !manifest ||
        downloading
      ) {
        return;
      }
      if (await appUpdateService.canInstallPackages().catch(() => false)) {
        waitingForPermission.current = false;
        await downloadAndInstall(manifest);
      }
    });
    return () => subscription.remove();
  }, [downloadAndInstall, downloading, manifest]);

  return (
    <>
      {children}
      <Modal
        animationType="fade"
        transparent
        visible={Boolean(manifest)}
        onRequestClose={() => {
          if (!manifest?.required && !downloading) setManifest(null);
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              {downloading ? (
                <ActivityIndicator color={Colors.primary} size="large" />
              ) : (
                <Download color={Colors.primary} size={28} strokeWidth={2.4} />
              )}
            </View>
            <Text style={styles.title}>
              {downloading ? 'Đang tải bản cập nhật' : 'Có phiên bản mới'}
            </Text>
            <Text style={styles.version}>Phiên bản {manifest?.versionName}</Text>

            {downloading ? (
              <View style={styles.progressSection}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressText}>{progress}%</Text>
              </View>
            ) : (
              <Text style={styles.notes}>{manifest?.notes}</Text>
            )}

            <View style={styles.safeRow}>
              <ShieldCheck color="#209765" size={18} />
              <Text style={styles.safeText}>File được kiểm tra trước khi cài đặt</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {!downloading ? (
              <View style={styles.actions}>
                {!manifest?.required ? (
                  <Pressable style={styles.laterButton} onPress={() => setManifest(null)}>
                    <Text style={styles.laterText}>Để sau</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.updateButton} onPress={beginUpdate}>
                  <Text style={styles.updateText}>{error ? 'Thử lại' : 'Cập nhật ngay'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(35, 20, 11, 0.54)',
  },
  card: {
    borderRadius: 26,
    padding: 24,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#F2D4B6',
  },
  iconWrap: {
    width: 58,
    height: 58,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#FFF3E5',
  },
  title: {
    marginTop: 16,
    color: '#4A2614',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  version: {
    marginTop: 5,
    color: '#956747',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  notes: {
    marginTop: 18,
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  progressSection: { marginTop: 22 },
  progressTrack: {
    height: 10,
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#F2E6DC',
  },
  progressFill: { height: '100%', borderRadius: 10, backgroundColor: Colors.primary },
  progressText: {
    marginTop: 8,
    color: '#6F4932',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  safeRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  safeText: { color: '#4F6F60', fontSize: 13, fontWeight: '600' },
  error: {
    marginTop: 14,
    color: Colors.error,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  actions: { marginTop: 22, flexDirection: 'row', gap: 10 },
  laterButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#F4EBE3',
  },
  laterText: { color: '#6F4932', fontSize: 15, fontWeight: '800' },
  updateButton: {
    flex: 1.25,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: Colors.primary,
  },
  updateText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
});

export default AppUpdateManager;
