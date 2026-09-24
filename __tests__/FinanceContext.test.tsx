import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { FinanceProvider, useFinance } from '../src/context/FinanceContext';

it('clears cached financial data on account changes and ignores setters from the old account', async () => {
  let current!: ReturnType<typeof useFinance>;
  const Probe = () => {
    current = useFinance();
    return null;
  };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(() => {
    renderer = ReactTestRenderer.create(
      <FinanceProvider ownerKey={1}>
        <Probe />
      </FinanceProvider>,
    );
  });
  const oldSetter = current.setTags;
  await act(() => {
    current.setTags([{ id: 3, name: 'riêng tư', user_id: 1, usage_count: 1 }]);
    current.setPreferredCurrency('USD');
  });
  expect(current.tags).toHaveLength(1);
  await act(() =>
    renderer.update(
      <FinanceProvider ownerKey={2}>
        <Probe />
      </FinanceProvider>,
    ),
  );
  expect(current.tags).toEqual([]);
  expect(current.preferredCurrency).toBe('VND');
  await act(() =>
    oldSetter([{ id: 3, name: 'phản hồi cũ', user_id: 1, usage_count: 1 }]),
  );
  expect(current.tags).toEqual([]);
  await act(() => renderer.unmount());
});
