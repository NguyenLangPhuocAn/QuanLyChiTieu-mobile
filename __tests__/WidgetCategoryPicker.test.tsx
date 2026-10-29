import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import WidgetCategoryPicker from '../src/components/WidgetCategoryPicker';
import type { Category } from '../src/types/category';
const choices: Category[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  name: i === 29 ? 'Bảo hiểm' : `Chi ${i + 1}`,
  type: 'EXPENSE',
  cash_flow_group: 'NORMAL',
  icon: 'categories/icons/expense_food.png',
  is_system: true,
}));
choices.push(
  { id: 40, name: 'Lương', type: 'INCOME' },
  { id: 41, name: 'Trả nợ', type: 'EXPENSE', cash_flow_group: 'LOAN_DEBT' },
);
let r: TestRenderer.ReactTestRenderer;
const buttons = () => r.root.findAllByType(TouchableOpacity);
afterEach(async () => {
  await act(async () => r.unmount());
});
it('renders the entire current-type catalog, including the last item, with the original icon component', async () => {
  await act(async () => {
    r = TestRenderer.create(
      <WidgetCategoryPicker
        categories={choices}
        type="EXPENSE"
        selectedId={30}
        onSelect={jest.fn()}
      />,
    );
  });
  expect(buttons()).toHaveLength(30);
  expect(buttons()[29].props.accessibilityLabel).toBe('Bảo hiểm');
  expect(buttons()[29].props.accessibilityState.selected).toBe(true);
  expect(
    buttons().some(n =>
      ['Lương', 'Trả nợ'].includes(n.props.accessibilityLabel),
    ),
  ).toBe(false);
});
it('searches by name and returns the original category ID without writing any transaction', async () => {
  const select = jest.fn();
  await act(async () => {
    r = TestRenderer.create(
      <WidgetCategoryPicker
        categories={choices}
        type="EXPENSE"
        selectedId={null}
        onSelect={select}
      />,
    );
  });
  const search = r.root.findAll(
    n =>
      n.props.accessibilityLabel === 'Tìm danh mục widget' &&
      typeof n.type !== 'string',
  )[0];
  await act(async () => search.props.onChangeText('BẢO'));
  expect(buttons()).toHaveLength(1);
  await act(async () => buttons()[0].props.onPress());
  expect(select).toHaveBeenCalledWith(choices[29]);
});
it('shows only income categories for Thu', async () => {
  await act(async () => {
    r = TestRenderer.create(
      <WidgetCategoryPicker
        categories={choices}
        type="INCOME"
        selectedId={null}
        onSelect={jest.fn()}
      />,
    );
  });
  expect(buttons().map(n => n.props.accessibilityLabel)).toEqual(['Lương']);
});
