import { parseBillBook, type BillScope } from './recurringBills';
import { parseMoneyPlans } from './moneyCalendarPlans';
import {
  planningLocalStore,
  type PlanningLocalState,
} from './planningLocalStore';
import type { BillBook } from '../utils/recurringBills';
import type { MoneyPlan } from '../utils/moneyCalendar';
export type PlanningSnapshot = {
  version: 1;
  book: BillBook;
  plans: MoneyPlan[];
};
export const parsePlanningSnapshot = (value: unknown): PlanningSnapshot => {
  const data = value as PlanningSnapshot;
  if (!data || data.version !== 1 || JSON.stringify(data).length > 512 * 1024)
    throw Error('Bản lịch không hợp lệ hoặc quá lớn.');
  const book = parseBillBook(JSON.stringify(data.book));
  if (
    book.bills.length > 1000 ||
    book.periods.length > 5000 ||
    (book.suggestions?.length ?? 0) > 2000 ||
    (book.reviewedAlerts?.length ?? 0) > 2000
  )
    throw Error('Bản lịch vượt giới hạn hỗ trợ.');
  return {
    version: 1,
    book,
    plans: parseMoneyPlans(JSON.stringify(data.plans)),
  };
};
export const snapshotOf = (state: PlanningLocalState): PlanningSnapshot =>
  parsePlanningSnapshot({
    version: 1,
    book:
      state.book === null
        ? { version: 1, bills: [], periods: [] }
        : JSON.parse(state.book),
    plans: state.plans === null ? [] : JSON.parse(state.plans),
  });
// Device notification opt-in never travels to a different phone.
export const portableSnapshot = (
  snapshot: PlanningSnapshot,
): PlanningSnapshot => ({
  ...snapshot,
  book: {
    ...snapshot.book,
    bills: snapshot.book.bills.map(
      ({ reminderEnabled: _ignored, ...bill }) => bill,
    ),
  },
});
export const stablePlanningJson = (value: unknown): string => {
  const visit = (v: unknown, depth: number): unknown => {
    if (depth > 16) throw Error('Bản lịch lồng quá nhiều lớp.');
    if (Array.isArray(v)) return v.map(item => visit(item, depth + 1));
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map(k => [k, visit((v as Record<string, unknown>)[k], depth + 1)]),
      );
    return v;
  };
  return JSON.stringify(visit(value, 0));
};
export const snapshotKey = (snapshot: PlanningSnapshot) =>
  stablePlanningJson(portableSnapshot(snapshot));
export const currentSnapshot = async (scope: BillScope) =>
  snapshotOf(await planningLocalStore.read(scope));
export const replacePlanningSnapshot = (
  state: PlanningLocalState,
  snapshot: PlanningSnapshot,
  keepReminders: boolean,
) => {
  const local = snapshotOf(state);
  const flags = new Map(local.book.bills.map(b => [b.id, b.reminderEnabled]));
  state.book = JSON.stringify({
    ...snapshot.book,
    bills: snapshot.book.bills.map(b => ({
      ...b,
      reminderEnabled: keepReminders ? flags.get(b.id) === true : false,
    })),
  });
  state.plans = JSON.stringify(snapshot.plans);
};
