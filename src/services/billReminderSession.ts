import { billReminder, billReminderOwner } from '../native/billReminder';
import { recurringBillsService, type BillScope } from './recurringBills';

let revision = 0;
let syncRevision = 0;
let current: BillScope | null = null;
let ready: Promise<void> = Promise.resolve();
export const billReminderSession = {
  async set(scope: BillScope | null) {
    const version = ++revision;
    syncRevision += 1;
    current = scope;
    if (!billReminder.isSupported) return;
    ready = billReminder.activate(scope);
    await ready;
    if (scope && version === revision) await this.sync(scope);
  },
  async sync(scope: BillScope) {
    if (
      !billReminder.isSupported ||
      !current ||
      billReminderOwner(current) !== billReminderOwner(scope)
    )
      return;
    const version = revision;
    const request = ++syncRevision;
    await ready;
    try {
      const book = await recurringBillsService.load(scope);
      if (version === revision && request === syncRevision)
        await billReminder.sync(scope, book);
    } catch (error) {
      if (version === revision && request === syncRevision)
        await billReminder.invalidate(scope).catch(() => undefined);
      throw error;
    }
  },
};
recurringBillsService.subscribe(scope => {
  // A notification failure never reverses a successfully stored bill/payment link.
  // The UI exposes sync status and can retry; native rechecks the active owner too.
  billReminderSession.sync(scope).catch(() => undefined);
});
