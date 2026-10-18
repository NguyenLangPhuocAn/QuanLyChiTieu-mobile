import { parseNaturalTransactionSearch } from '../naturalTransactionSearch';

describe('parseNaturalTransactionSearch', () => {
  const options = {
    now: new Date(2026, 9, 17),
    wallets: [
      {
        id: 2,
        user_id: 7,
        name: 'Ví tiền mặt',
        currency: 'VND',
        balance: 0,
        created_at: '2026-01-01',
      },
    ],
    categories: [
      {
        id: 3,
        name: 'Ăn uống',
        type: 'EXPENSE' as const,
        cash_flow_group: 'NORMAL' as const,
      },
    ],
  };

  it('understands a Vietnamese category, period and minimum amount', () => {
    const result = parseNaturalTransactionSearch(
      'ăn uống tháng trước trên 200 nghìn',
      options,
    );

    expect(result).toMatchObject({
      type: 'EXPENSE',
      categoryId: 3,
      from: '2026-09-01',
      to: '2026-09-30',
      minAmount: 200_000,
    });
  });

  it('understands wallet, income and an amount range', () => {
    const result = parseNaturalTransactionSearch(
      'thu ví tiền mặt từ 1 triệu đến 5 triệu',
      options,
    );

    expect(result).toMatchObject({
      type: 'INCOME',
      walletId: 2,
      minAmount: 1_000_000,
      maxAmount: 5_000_000,
    });
  });

  it('keeps unknown words as a visible text filter', () => {
    const result = parseNaturalTransactionSearch('chi Grab tuần này', options);

    expect(result.q).toBe('grab');
    expect(result.from).toBe('2026-10-12');
    expect(result.to).toBe('2026-10-18');
  });

  it('understands yesterday and the previous week', () => {
    expect(parseNaturalTransactionSearch('chi hôm qua', options)).toMatchObject(
      {
        type: 'EXPENSE',
        from: '2026-10-16',
        to: '2026-10-16',
      },
    );
    expect(
      parseNaturalTransactionSearch('Grab tuần trước', options),
    ).toMatchObject({
      from: '2026-10-05',
      to: '2026-10-11',
      q: 'grab',
    });
  });

  it('understands a Vietnamese date range without treating dates as amounts', () => {
    const result = parseNaturalTransactionSearch(
      'ăn uống từ ngày 01/10 đến 15/10',
      options,
    );

    expect(result).toMatchObject({
      categoryId: 3,
      from: '2026-10-01',
      to: '2026-10-15',
    });
    expect(result.minAmount).toBeUndefined();
    expect(result.maxAmount).toBeUndefined();
  });

  it('understands quarters and common amount synonyms', () => {
    expect(
      parseNaturalTransactionSearch('chi quý trước không quá 2 triệu', options),
    ).toMatchObject({
      type: 'EXPENSE',
      from: '2026-07-01',
      to: '2026-09-30',
      maxAmount: 2_000_000,
    });
    expect(
      parseNaturalTransactionSearch(
        'hoàn tiền 7 ngày qua ít nhất 50k',
        options,
      ),
    ).toMatchObject({
      type: 'INCOME',
      from: '2026-10-11',
      to: '2026-10-17',
      minAmount: 50_000,
    });
  });
});
