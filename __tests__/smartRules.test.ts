import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  findMatchingSmartRule,
  smartRulesService,
} from '../src/services/smartRules';

describe('findMatchingSmartRule', () => {
  const rules = [
    {
      id: 'grab',
      keyword: 'Grab',
      categoryId: 9,
      categoryName: 'Di chuyển',
      enabled: true,
    },
  ];

  it('matches a keyword without case sensitivity', () => {
    expect(findMatchingSmartRule('Đi GRAB về nhà', rules)?.categoryName).toBe(
      'Di chuyển',
    );
    expect(findMatchingSmartRule('đặt grab về nhà', rules)?.categoryName).toBe(
      'Di chuyển',
    );
  });

  it('ignores disabled rules', () => {
    expect(
      findMatchingSmartRule('Grab', [{ ...rules[0], enabled: false }]),
    ).toBeNull();
  });

  it('uses the last rule deterministically if legacy data contains a duplicate keyword', () => {
    expect(
      findMatchingSmartRule('Grab', [
        rules[0],
        { ...rules[0], id: 'grab-food', categoryName: 'Ăn uống' },
      ])?.categoryName,
    ).toBe('Ăn uống');
  });

  it('prefers the more specific keyword when several rules match a note', () => {
    expect(
      findMatchingSmartRule('Đặt Grab Food', [
        rules[0],
        {
          ...rules[0],
          id: 'grab-food',
          keyword: 'Grab Food',
          categoryName: 'Ăn uống',
        },
      ])?.categoryName,
    ).toBe('Ăn uống');
  });

  it('matches an income category rule with the same engine', () => {
    expect(
      findMatchingSmartRule('Đã nhận LƯƠNG tháng 10', [
        {
          id: 'salary',
          keyword: 'lương',
          categoryId: 21,
          categoryName: 'Tiền lương',
          enabled: true,
        },
      ])?.categoryName,
    ).toBe('Tiền lương');
  });
});

it('keeps an intentionally empty rule list after reopening the local store', async () => {
  const storage = new Map<string, string>();
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementation(async key => storage.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    storage.set(key, value);
  });

  expect(await smartRulesService.hasSavedRules(7)).toBe(false);
  await smartRulesService.saveRules(7, [
    {
      id: 'grab',
      keyword: 'Grab',
      categoryId: 9,
      categoryName: 'Di chuyển',
      enabled: true,
    },
  ]);
  await smartRulesService.saveRules(7, []);
  expect(await smartRulesService.hasSavedRules(7)).toBe(true);
  expect(await smartRulesService.getRules(7)).toEqual([]);
  expect(await smartRulesService.hasSavedRules(8)).toBe(false);
});
