// QA-only fault injection. The normal Metro/release config never imports this.
import { homeWidget as actual } from '../src/native/homeWidget';
let failOnce = true;
export const homeWidget = {
  ...actual,
  closeQuickEntry: async (result = 'CANCEL') => {
    if (failOnce && (result === 'SAVED' || result === 'PENDING')) {
      failOnce = false;
      throw Error('QA: simulated native close failure after acknowledgement');
    }
    return actual.closeQuickEntry(result);
  },
};
