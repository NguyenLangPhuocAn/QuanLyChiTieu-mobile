import type { ChatTransactionDraft } from '../types/chatbot';

const normalize = (value: string) => value.trim().toLocaleLowerCase('vi-VN');

// Resolve only explicit, unambiguous names. Never select a wallet/category from chat history.
export function resolveChatDraftSelections(
  draft: ChatTransactionDraft,
  wallets: Array<{
    id: number;
    name: string;
    currency: string;
    wallet_type?: string;
  }>,
  categories: Array<{ id: number; name: string; type?: string | null }>,
) {
  const matchingWallets = draft.wallet_name
    ? wallets.filter(
        wallet =>
          wallet.wallet_type !== 'SAVINGS' &&
          normalize(wallet.name) === normalize(draft.wallet_name!) &&
          (!draft.currency || wallet.currency === draft.currency),
      )
    : [];
  const matchingCategories = draft.category_name
    ? categories.filter(
        category =>
          category.type === draft.type &&
          normalize(category.name) === normalize(draft.category_name!),
      )
    : [];
  return {
    walletId: matchingWallets.length === 1 ? matchingWallets[0].id : null,
    categoryId:
      matchingCategories.length === 1 ? matchingCategories[0].id : null,
  };
}
