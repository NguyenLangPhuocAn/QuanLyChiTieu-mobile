import { parseVoiceTransactionDraft } from '../voiceTransactionDraft';

const now = new Date(2026, 9, 21, 23, 30);
describe('local voice transaction preview', () => {
  it.each([
    ['Chi 79 nghìn ăn trưa hôm nay', 79000, 'EXPENSE'],
    ['CHI bảy mươi chín nghìn ăn trưa', 79000, 'EXPENSE'],
    ['Chi một trăm hai mươi lăm nghìn mua đồ', 125000, 'EXPENSE'],
    ['Thu một triệu rưỡi tiền làm thêm', 1500000, 'INCOME'],
    ['Nhận 1 triệu 200 nghìn tiền công', 1200000, 'INCOME'],
    ['Mua đồ 1,5 triệu', 1500000, 'EXPENSE'],
    ['Chi 79.000 đồng cà phê', 79000, 'EXPENSE'],
    ['chi 79k ăn trưa', 79000, 'EXPENSE'],
    ['Thu mười hai triệu năm trăm nghìn lương', 12500000, 'INCOME'],
  ])(
    'understands %s without selecting a wallet or category',
    (text, amount, type) => {
      const preview = parseVoiceTransactionDraft(text, now);
      expect(preview.issues).toEqual([]);
      expect(preview.draft).toMatchObject({
        amount,
        type,
        currency: 'VND',
        note: text,
        transaction_date: '2026-10-21',
        wallet_name: null,
        category_name: null,
      });
    },
  );
  it('handles yesterday across a month boundary and explicit dates', () => {
    expect(
      parseVoiceTransactionDraft('chi 30 nghìn hôm qua', new Date(2026, 2, 1))
        .draft?.transaction_date,
    ).toBe('2026-02-28');
    expect(
      parseVoiceTransactionDraft('thu 100 USD ngày 20/10/2026', now).draft,
    ).toMatchObject({
      amount: 100,
      currency: 'USD',
      transaction_date: '2026-10-20',
    });
  });
  it.each([
    '',
    'cà phê',
    '79 nghìn cà phê',
    'chi 0 đồng',
    'chi 79 nghìn và thu 100 nghìn',
    'chi 79 nghìn và 30 nghìn',
    'chi ngày 20/10/2026',
    'chi 79 nghìn ngày 31/02/2026',
    'chi 79 nghìn tuần trước',
    'trả nợ 79 nghìn',
    'chi 20 euro',
    'thu 20 USD và 30000 VND',
    'chi 999999999999999999999999 đồng',
    'chi hai ba nghìn',
  ])('requires review for %s', text => {
    const preview = parseVoiceTransactionDraft(text, now);
    expect(preview.draft).toBeNull();
    expect(preview.issues.length).toBeGreaterThan(0);
  });
});
