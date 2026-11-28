import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { homeWidget } from '../native/homeWidget';
import { offlineTransactionQueue } from '../services/offlineTransactionQueue';
import { offlineCategoryQueue } from '../services/offlineCategoryQueue';
import { offlineWalletQueue } from '../services/offlineWalletQueue';
import { offlineBudgetQueue } from '../services/offlineBudgetQueue';
import { offlineSavingsGoalQueue } from '../services/offlineSavingsGoalQueue';
import { savingsService } from '../services/savings';
import { offlineLoanDebtQueue } from '../services/offlineLoanDebtQueue';
import { offlineLoanCreateQueue } from '../services/offlineLoanCreateQueue';
import { loanDebtsService } from '../services/loanDebts';
import { budgetsService } from '../services/budgets';
import { walletsService } from '../services/wallets';
import { categoriesService } from '../services/categories';
import {
  offlineTransactionChanges,
  snapshotTransaction,
} from '../services/offlineTransactionChanges';
import { transactionsService } from '../services/transactions';
import { financeRefresh } from '../services/financeRefresh';
import { getApiStorageBaseUrl } from '../services/api';
import OfflineSyncReviewModal, {
  type OfflineSyncReview,
} from './OfflineSyncReviewModal';
import {
  discardUnselected,
  reviewItemKeys,
} from '../services/offlineSelection';

// Retry only while a foreground session has local writes waiting for the API.
// Android connectivity events do not cover an API outage on working Wi-Fi.
const RECONNECT_RETRY_MS = 20_000;
const promptedUsers = new Set<number>();
export default function OfflineSessionSync({
  onSynced,
}: { onSynced?: () => Promise<void> } = {}) {
  const { user, token, isRestoringSession, retryRestoreSession } = useAuth();
  const server = getApiStorageBaseUrl();
  const [review, setReview] = useState<OfflineSyncReview | null>(null);
  const choiceRef = useRef<
    | ((choice: 'later' | 'local' | 'server', selected?: string[]) => void)
    | null
  >(null);
  const latest = useRef({
    userId: user?.id,
    token,
    retryRestoreSession,
    onSynced,
  });
  latest.current = { userId: user?.id, token, retryRestoreSession, onSynced };
  useEffect(() => {
    if (!user?.id || isRestoringSession) return;
    const userId = user.id;
    let active = true,
      running = false,
      asking = false,
      reviewVisible = false,
      shownKey = '';
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const clearRetry = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = undefined;
    };
    const scheduleRetry = () => {
      if (!active || asking || retryTimer || AppState.currentState !== 'active')
        return;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        attempt().catch(() => undefined);
      }, RECONNECT_RETRY_MS);
    };
    const refresh = async () => {
      await latest.current.onSynced?.();
      financeRefresh.emit();
    };
    const attempt = async () => {
      if (
        !active ||
        running ||
        asking ||
        promptedUsers.has(userId) ||
        AppState.currentState !== 'active'
      )
        return;
      running = true;
      let retryPending = false;
      try {
        const current = () =>
          active &&
          latest.current.userId === userId &&
          getApiStorageBaseUrl() === server;
        const drafts = (await offlineTransactionQueue.list(userId)).filter(
          item => item.server === server,
        );
        const changes = await offlineTransactionChanges.list(userId);
        const categories = await offlineCategoryQueue.list(userId);
        const wallets = await offlineWalletQueue.list(userId);
        const budgets = await offlineBudgetQueue.list(userId);
        const savingsGoals = await offlineSavingsGoalQueue.list(userId);
        const loanDebts = await offlineLoanDebtQueue.list(userId);
        const loanCreates = await offlineLoanCreateQueue.list(userId);
        if (!current()) return;
        retryPending = Boolean(
          drafts.length ||
            changes.length ||
            categories.length ||
            wallets.length ||
            budgets.length ||
            savingsGoals.length ||
            loanDebts.length ||
            loanCreates.length,
        );
        if (offlineTransactionQueue.isSyncing(userId)) return;
        if (!(await homeWidget.connected())) return;
        if (!(await latest.current.retryRestoreSession())) return;
        if (!current() || !latest.current.token) return;
        if (
          !drafts.length &&
          !changes.length &&
          !categories.length &&
          !wallets.length &&
          !budgets.length &&
          !savingsGoals.length &&
          !loanDebts.length &&
          !loanCreates.length
        ) {
          shownKey = '';
          clearRetry();
          if (current()) await refresh();
          return;
        }
        const expected = drafts.map(item => ({
          id: item.id,
          updatedAt: item.updatedAt,
        }));
        const expectedChanges = await offlineTransactionChanges.preview(userId);
        const expectedCategories = await offlineCategoryQueue.preview(userId);
        const expectedWallets = await offlineWalletQueue.preview(userId);
        const expectedBudgets = await offlineBudgetQueue.preview(userId);
        const expectedSavingsGoals = await offlineSavingsGoalQueue.preview(
          userId,
        );
        const expectedLoanDebts = await offlineLoanDebtQueue.preview(userId);
        const expectedLoanCreates = await offlineLoanCreateQueue.preview(
          userId,
        );
        const key = JSON.stringify([
          expected,
          expectedChanges,
          expectedCategories,
          expectedWallets,
          expectedBudgets,
          expectedSavingsGoals,
          expectedLoanDebts,
          expectedLoanCreates,
        ]);
        if (shownKey === key || !current()) {
          retryPending = false;
          return;
        }
        const remote: OfflineSyncReview['remote'] = {};
        const remoteCategories: NonNullable<
          OfflineSyncReview['remoteCategories']
        > = {};
        const remoteWallets: NonNullable<OfflineSyncReview['remoteWallets']> =
          {};
        const remoteBudgets: NonNullable<OfflineSyncReview['remoteBudgets']> =
          {};
        const remoteSavingsGoals: NonNullable<
          OfflineSyncReview['remoteSavingsGoals']
        > = {};
        const remoteLoanDebts: NonNullable<
          OfflineSyncReview['remoteLoanDebts']
        > = {};
        const remoteLoanWallets: NonNullable<
          OfflineSyncReview['remoteLoanWallets']
        > = {};
        if (loanCreates.length) {
          const serverWallets = await walletsService.getAll(
            latest.current.token,
          );
          for (const item of loanCreates)
            remoteLoanWallets[item.wallet.id] =
              serverWallets.find(row => row.id === item.wallet.id) ?? null;
        }
        if (loanDebts.length) {
          const serverLoans = await loanDebtsService.getAll(
            latest.current.token,
          );
          for (const item of loanDebts)
            remoteLoanDebts[item.id] =
              serverLoans.find(row => row.id === item.id) ?? null;
        }
        if (savingsGoals.length) {
          const serverGoals = await savingsService.getAll(latest.current.token);
          for (const item of savingsGoals)
            remoteSavingsGoals[item.id] =
              serverGoals.find(row => row.id === item.id) ?? null;
        }
        if (budgets.some(item => item.action !== 'CREATE')) {
          const serverBudgets = await budgetsService.getAll(
            latest.current.token,
          );
          for (const item of budgets)
            if (item.action !== 'CREATE')
              remoteBudgets[item.id] =
                serverBudgets.find(row => row.id === item.id) ?? null;
        }
        if (wallets.some(item => item.action !== 'CREATE')) {
          const serverWallets = await walletsService.getAll(
            latest.current.token,
          );
          for (const item of wallets)
            if (item.action !== 'CREATE')
              remoteWallets[item.id] =
                serverWallets.find(row => row.id === item.id) ?? null;
        }
        if (categories.some(item => item.action !== 'CREATE')) {
          const serverCategories = await categoriesService.getAll(
            latest.current.token,
          );
          for (const item of categories)
            if (item.action !== 'CREATE')
              remoteCategories[item.id] =
                serverCategories.find(row => row.id === item.id) ?? null;
        }
        if (changes.length) {
          for (let offset = 0; offset < changes.length; offset += 100) {
            const batch = changes.slice(offset, offset + 100);
            const response = await transactionsService.getLinkedPayments(
              latest.current.token,
              batch.map(item => item.transactionId),
            );
            for (const item of batch) {
              const row = response.data.find(
                entry => entry.id === item.transactionId,
              );
              remote[item.transactionId] = row
                ? snapshotTransaction(row)
                : null;
            }
          }
        }
        if (!current()) return;
        // A manual sync may finish while remote snapshots are being fetched.
        // Never offer a choice for a queue that has already changed or emptied.
        const latestDrafts = (
          await offlineTransactionQueue.list(userId)
        ).filter(item => item.server === server);
        const latestChanges = await offlineTransactionChanges.preview(userId);
        const latestCategories = await offlineCategoryQueue.preview(userId);
        const latestWallets = await offlineWalletQueue.preview(userId);
        const latestBudgets = await offlineBudgetQueue.preview(userId);
        const latestSavingsGoals = await offlineSavingsGoalQueue.preview(
          userId,
        );
        const latestLoanDebts = await offlineLoanDebtQueue.preview(userId);
        const latestLoanCreates = await offlineLoanCreateQueue.preview(userId);
        if (
          !current() ||
          offlineTransactionQueue.isSyncing(userId) ||
          JSON.stringify(
            latestDrafts.map(item => ({
              id: item.id,
              updatedAt: item.updatedAt,
            })),
          ) !== JSON.stringify(expected) ||
          JSON.stringify(latestChanges) !== JSON.stringify(expectedChanges) ||
          JSON.stringify(latestCategories) !==
            JSON.stringify(expectedCategories) ||
          JSON.stringify(latestWallets) !== JSON.stringify(expectedWallets) ||
          JSON.stringify(latestBudgets) !== JSON.stringify(expectedBudgets) ||
          JSON.stringify(latestSavingsGoals) !==
            JSON.stringify(expectedSavingsGoals) ||
          JSON.stringify(latestLoanDebts) !==
            JSON.stringify(expectedLoanDebts) ||
          JSON.stringify(latestLoanCreates) !==
            JSON.stringify(expectedLoanCreates)
        )
          return;
        shownKey = key;
        asking = true;
        reviewVisible = true;
        retryPending = false;
        clearRetry();
        promptedUsers.add(userId);
        const reviewData: OfflineSyncReview = {
          drafts,
          changes,
          categories,
          wallets,
          budgets,
          savingsGoals,
          loanDebts,
          loanCreates,
          remote,
          remoteCategories,
          remoteWallets,
          remoteBudgets,
          remoteSavingsGoals,
          remoteLoanDebts,
          remoteLoanWallets,
        };
        const choose = async (
          source: 'local' | 'cloud',
          selected?: string[],
        ) => {
          let retryAfterChoice = false;
          try {
            if (!current() || !latest.current.token) return;
            if (source === 'cloud') {
              const nowChanges = await offlineTransactionChanges.preview(
                userId,
              );
              if (
                JSON.stringify(nowChanges) !== JSON.stringify(expectedChanges)
              )
                throw Error(
                  'Thay đổi trên máy đã đổi. Hãy xem lại trước khi bỏ.',
                );
              const [
                nowCategories,
                nowWallets,
                nowBudgets,
                nowSavingsGoals,
                nowLoanDebts,
                nowLoanCreates,
              ] = await Promise.all([
                offlineCategoryQueue.preview(userId),
                offlineWalletQueue.preview(userId),
                offlineBudgetQueue.preview(userId),
                offlineSavingsGoalQueue.preview(userId),
                offlineLoanDebtQueue.preview(userId),
                offlineLoanCreateQueue.preview(userId),
              ]);
              if (
                JSON.stringify(nowCategories) !==
                  JSON.stringify(expectedCategories) ||
                JSON.stringify(nowWallets) !==
                  JSON.stringify(expectedWallets) ||
                JSON.stringify(nowBudgets) !==
                  JSON.stringify(expectedBudgets) ||
                JSON.stringify(nowSavingsGoals) !==
                  JSON.stringify(expectedSavingsGoals) ||
                JSON.stringify(nowLoanDebts) !==
                  JSON.stringify(expectedLoanDebts) ||
                JSON.stringify(nowLoanCreates) !==
                  JSON.stringify(expectedLoanCreates)
              )
                throw Error(
                  'Dữ liệu trên máy đã đổi. Hãy xem lại trước khi bỏ.',
                );
              await offlineTransactionQueue.discardLocal(userId, expected);
              await offlineTransactionChanges.discard(userId, expectedChanges);
              await offlineCategoryQueue.discard(userId, expectedCategories);
              await offlineWalletQueue.discard(userId, expectedWallets);
              await offlineBudgetQueue.discard(userId, expectedBudgets);
              await offlineSavingsGoalQueue.discard(
                userId,
                expectedSavingsGoals,
              );
              await offlineLoanDebtQueue.discard(userId, expectedLoanDebts);
              await offlineLoanCreateQueue.discard(userId, expectedLoanCreates);
              shownKey = '';
            } else {
              const now = (await offlineTransactionQueue.list(userId)).filter(
                item => item.server === server,
              );
              if (
                JSON.stringify(
                  now.map(item => ({ id: item.id, updatedAt: item.updatedAt })),
                ) !== JSON.stringify(expected)
              )
                throw Error(
                  'Bản trên máy đã thay đổi. Hãy xem lại trước khi đồng bộ.',
                );
              if (
                JSON.stringify(
                  await offlineTransactionChanges.preview(userId),
                ) !== JSON.stringify(expectedChanges)
              )
                throw Error(
                  'Thay đổi trên máy đã đổi. Hãy xem lại trước khi đồng bộ.',
                );
              if (
                JSON.stringify(await offlineCategoryQueue.preview(userId)) !==
                JSON.stringify(expectedCategories)
              )
                throw Error(
                  'Danh mục trên máy đã đổi. Hãy xem lại trước khi đồng bộ.',
                );
              if (
                JSON.stringify(await offlineWalletQueue.preview(userId)) !==
                JSON.stringify(expectedWallets)
              )
                throw Error(
                  'Ví trên máy đã đổi. Hãy xem lại trước khi đồng bộ.',
                );
              if (
                JSON.stringify(await offlineBudgetQueue.preview(userId)) !==
                JSON.stringify(expectedBudgets)
              )
                throw Error('Ngân sách trên máy đã đổi. Hãy xem lại.');
              if (
                JSON.stringify(
                  await offlineSavingsGoalQueue.preview(userId),
                ) !== JSON.stringify(expectedSavingsGoals)
              )
                throw Error('Mục tiêu trên máy đã đổi. Hãy xem lại.');
              if (
                JSON.stringify(await offlineLoanDebtQueue.preview(userId)) !==
                JSON.stringify(expectedLoanDebts)
              )
                throw Error('Khoản Vay/Nợ trên máy đã đổi. Hãy xem lại.');
              if (
                JSON.stringify(await offlineLoanCreateQueue.preview(userId)) !==
                JSON.stringify(expectedLoanCreates)
              )
                throw Error('Khoản Vay/Nợ mới trên máy đã đổi. Hãy xem lại.');
              // The user may keep only some of the reviewed items. Everything
              // left unchecked is removed from the device before syncing.
              let selExpected = expected;
              let selChanges = expectedChanges;
              let selCategories = expectedCategories;
              let selWallets = expectedWallets;
              let selBudgets = expectedBudgets;
              let selSavingsGoals = expectedSavingsGoals;
              let selLoanDebts = expectedLoanDebts;
              let selLoanCreates = expectedLoanCreates;
              if (selected) {
                const remaining = await discardUnselected(
                  userId,
                  selected,
                  reviewData,
                  {
                    drafts: expected,
                    changes: expectedChanges,
                    categories: expectedCategories,
                    wallets: expectedWallets,
                    budgets: expectedBudgets,
                    savingsGoals: expectedSavingsGoals,
                    loanDebts: expectedLoanDebts,
                    loanCreates: expectedLoanCreates,
                  },
                );
                selExpected = remaining.drafts;
                selChanges = remaining.changes;
                selCategories = remaining.categories;
                selWallets = remaining.wallets;
                selBudgets = remaining.budgets;
                selSavingsGoals = remaining.savingsGoals;
                selLoanDebts = remaining.loanDebts;
                selLoanCreates = remaining.loanCreates;
              }
              const rebasedWallets = await offlineWalletQueue.rebaseReviewed(
                latest.current.token,
                userId,
                selWallets,
                remoteWallets,
              );
              const walletResult = await offlineWalletQueue.sync(
                latest.current.token,
                userId,
                rebasedWallets,
                current,
              );
              const rebasedCategories =
                await offlineCategoryQueue.rebaseReviewed(
                  latest.current.token,
                  userId,
                  selCategories,
                  remoteCategories,
                );
              const categoryResult = await offlineCategoryQueue.sync(
                latest.current.token,
                userId,
                rebasedCategories,
                current,
              );
              const categoriesReady =
                !categoryResult.pending &&
                !categoryResult.needsReview &&
                !walletResult.pending &&
                !walletResult.needsReview;
              const budgetResult = categoriesReady
                ? await offlineBudgetQueue.sync(
                    latest.current.token,
                    userId,
                    await offlineBudgetQueue.rebaseReviewed(
                      latest.current.token,
                      userId,
                      selBudgets,
                      remoteBudgets,
                    ),
                    current,
                  )
                : { synced: 0, pending: selBudgets.length, needsReview: 0 };
              const savingsResult = await offlineSavingsGoalQueue.sync(
                latest.current.token,
                userId,
                await offlineSavingsGoalQueue.rebaseReviewed(
                  latest.current.token,
                  userId,
                  selSavingsGoals,
                  remoteSavingsGoals,
                ),
                current,
              );
              const loanResult = await offlineLoanDebtQueue.sync(
                latest.current.token,
                userId,
                await offlineLoanDebtQueue.rebaseReviewed(
                  latest.current.token,
                  userId,
                  selLoanDebts,
                  remoteLoanDebts,
                ),
                current,
              );
              const loanCreateResult = await offlineLoanCreateQueue.sync(
                latest.current.token,
                userId,
                await offlineLoanCreateQueue.rebaseReviewed(
                  latest.current.token,
                  userId,
                  selLoanCreates,
                  remoteLoanWallets,
                ),
                remoteLoanWallets,
                current,
              );
              const result = categoriesReady
                ? await offlineTransactionQueue.sync(
                    latest.current.token,
                    userId,
                    current,
                    selExpected,
                  )
                : { synced: 0, pending: selExpected.length, needsReview: 0 };
              const edits =
                !categoriesReady || result.pending || result.needsReview
                  ? {
                      synced: 0,
                      pending: selChanges.length,
                      needsReview: 0,
                    }
                  : await offlineTransactionChanges.sync(
                      latest.current.token,
                      userId,
                      selChanges,
                      current,
                    );
              if (
                result.pending ||
                result.needsReview ||
                edits.pending ||
                edits.needsReview ||
                categoryResult.pending ||
                categoryResult.needsReview ||
                walletResult.pending ||
                walletResult.needsReview ||
                budgetResult.pending ||
                budgetResult.needsReview ||
                savingsResult.pending ||
                savingsResult.needsReview ||
                loanResult.pending ||
                loanResult.needsReview ||
                loanCreateResult.pending ||
                loanCreateResult.needsReview
              ) {
                shownKey = '';
                retryAfterChoice = Boolean(
                  result.pending ||
                    edits.pending ||
                    categoryResult.pending ||
                    walletResult.pending ||
                    budgetResult.pending ||
                    savingsResult.pending ||
                    loanResult.pending ||
                    loanCreateResult.pending,
                );
                Alert.alert(
                  'Còn dữ liệu cần kiểm tra',
                  `${
                    result.pending +
                    edits.pending +
                    categoryResult.pending +
                    walletResult.pending +
                    budgetResult.pending +
                    savingsResult.pending +
                    loanResult.pending +
                    loanCreateResult.pending
                  } đang chờ · ${
                    result.needsReview +
                    edits.needsReview +
                    categoryResult.needsReview +
                    walletResult.needsReview +
                    budgetResult.needsReview +
                    savingsResult.needsReview +
                    loanResult.needsReview +
                    loanCreateResult.needsReview
                  } cần xem lại.`,
                );
              } else {
                shownKey = '';
                const savedCount =
                  result.synced +
                  edits.synced +
                  categoryResult.synced +
                  walletResult.synced +
                  budgetResult.synced +
                  savingsResult.synced +
                  loanResult.synced +
                  loanCreateResult.synced;
                if (savedCount > 0 && current())
                  Alert.alert(
                    'Đã sao lưu dữ liệu thành công',
                    `${savedCount} thay đổi đã được lưu lên máy chủ.`,
                  );
              }
            }
            if (current()) await refresh();
          } catch (error) {
            shownKey = '';
            retryAfterChoice = source === 'local';
            Alert.alert(
              'Chưa hoàn tất',
              error instanceof Error
                ? error.message
                : 'Dữ liệu trên máy vẫn được giữ nguyên.',
            );
          } finally {
            asking = false;
            promptedUsers.delete(userId);
            choiceRef.current = null;
            if (retryAfterChoice && current()) scheduleRetry();
          }
        };
        choiceRef.current = (choice, selected) => {
          if (choice === 'later') {
            setReview(null);
            reviewVisible = false;
            asking = false;
            promptedUsers.delete(userId);
            choiceRef.current = null;
          } else if (choice === 'local') {
            const dropped = selected
              ? reviewItemKeys(reviewData).length - selected.length
              : 0;
            if (!selected || dropped <= 0) {
              setReview(null);
              reviewVisible = false;
              choose('local').catch(() => undefined);
              return;
            }
            Alert.alert(
              'Xóa mục không chọn?',
              `${selected.length} mục đã chọn sẽ được đồng bộ. ${dropped} mục không chọn sẽ bị xóa khỏi điện thoại và không gửi lên máy chủ.`,
              [
                { text: 'Quay lại', style: 'cancel' },
                {
                  text: 'Đồng bộ và xóa',
                  style: 'destructive',
                  onPress: () => {
                    setReview(null);
                    reviewVisible = false;
                    choose('local', selected).catch(() => undefined);
                  },
                },
              ],
            );
          } else {
            Alert.alert(
              'Bỏ thay đổi trên máy?',
              `${
                drafts.length +
                changes.length +
                categories.length +
                wallets.length +
                budgets.length +
                savingsGoals.length +
                loanDebts.length +
                loanCreates.length
              } thay đổi chưa đồng bộ sẽ bị bỏ khỏi điện thoại. Dữ liệu trên máy chủ được giữ nguyên.`,
              [
                { text: 'Quay lại', style: 'cancel' },
                {
                  text: 'Bỏ thay đổi',
                  style: 'destructive',
                  onPress: () => {
                    setReview(null);
                    reviewVisible = false;
                    choose('cloud').catch(() => undefined);
                  },
                },
              ],
            );
          }
        };
        setReview(reviewData);
      } catch {
        /* Durable drafts remain; retry only for pending writes in foreground. */
      } finally {
        running = false;
        if (retryPending) scheduleRetry();
      }
    };
    const reviewQueueChanged = () => {
      if (!reviewVisible) {
        attempt().catch(() => undefined);
        return;
      }
      Promise.all([
        offlineTransactionQueue.list(userId),
        offlineTransactionChanges.preview(userId),
        offlineCategoryQueue.preview(userId),
        offlineWalletQueue.preview(userId),
        offlineBudgetQueue.preview(userId),
        offlineSavingsGoalQueue.preview(userId),
        offlineLoanDebtQueue.preview(userId),
        offlineLoanCreateQueue.preview(userId),
      ])
        .then(
          ([
            drafts,
            changes,
            categories,
            wallets,
            budgets,
            savingsGoals,
            loanDebts,
            loanCreates,
          ]) => {
            if (!active || !reviewVisible) return;
            const key = JSON.stringify([
              drafts
                .filter(item => item.server === server)
                .map(item => ({ id: item.id, updatedAt: item.updatedAt })),
              changes,
              categories,
              wallets,
              budgets,
              savingsGoals,
              loanDebts,
              loanCreates,
            ]);
            if (key === shownKey) return;
            setReview(null);
            reviewVisible = false;
            asking = false;
            shownKey = '';
            promptedUsers.delete(userId);
            choiceRef.current = null;
            attempt().catch(() => undefined);
          },
        )
        .catch(() => undefined);
    };
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') attempt().catch(() => undefined);
      else clearRetry();
    });
    const reconnect = homeWidget.subscribe(() => {
      attempt().catch(() => undefined);
    });
    const queued = offlineTransactionQueue.subscribe(reviewQueueChanged);
    const changed = offlineTransactionChanges.subscribe(reviewQueueChanged);
    const changedCategories =
      offlineCategoryQueue.subscribe(reviewQueueChanged);
    const changedWallets = offlineWalletQueue.subscribe(reviewQueueChanged);
    const changedBudgets = offlineBudgetQueue.subscribe(reviewQueueChanged);
    const changedSavingsGoals =
      offlineSavingsGoalQueue.subscribe(reviewQueueChanged);
    const changedLoanDebts = offlineLoanDebtQueue.subscribe(reviewQueueChanged);
    const changedLoanCreates =
      offlineLoanCreateQueue.subscribe(reviewQueueChanged);
    attempt().catch(() => undefined);
    return () => {
      active = false;
      reviewVisible = false;
      clearRetry();
      if (asking) promptedUsers.delete(userId);
      choiceRef.current = null;
      setReview(null);
      foreground.remove();
      reconnect();
      queued();
      changed();
      changedCategories();
      changedWallets();
      changedBudgets();
      changedSavingsGoals();
      changedLoanDebts();
      changedLoanCreates();
    };
  }, [user?.id, server, isRestoringSession]);
  return (
    <OfflineSyncReviewModal
      review={review}
      onChoose={(choice, selected) => choiceRef.current?.(choice, selected)}
    />
  );
}
