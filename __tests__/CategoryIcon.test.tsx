import React from 'react';
import { Image } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import CategoryIcon from '../src/components/CategoryIcon';
import { resolveCategoryIconUrls } from '../src/utils/categoryIcons';
import { API_BASE_URLS } from '../src/services/api';

it('tries the next server for the transport icon and resets when the icon changes', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await act(() => {
    renderer = ReactTestRenderer.create(
      <CategoryIcon icon="categories/icons/expense_transport.png" />,
    );
  });
  expect(renderer!.root.findByType(Image).props.source.uri).toBe(
    `${API_BASE_URLS[0]}/public/categories/icons/expense_transport.png`,
  );
  await act(() => renderer!.root.findByType(Image).props.onError());
  expect(renderer!.root.findByType(Image).props.source.uri).toBe(
    `${API_BASE_URLS[1]}/public/categories/icons/expense_transport.png`,
  );
  await act(() =>
    renderer!.update(<CategoryIcon icon="categories/icons/expense_food.png" />),
  );
  expect(renderer!.root.findByType(Image).props.source.uri).toBe(
    `${API_BASE_URLS[0]}/public/categories/icons/expense_food.png`,
  );
  for (let i = 0; i < API_BASE_URLS.length; i++) {
    await act(() => renderer!.root.findByType(Image).props.onError());
  }
  expect(renderer!.root.findAllByType(Image)).toHaveLength(0);
  await act(() => renderer!.unmount());
});

it('keeps absolute URLs and handles public paths without duplicating directories', () => {
  expect(resolveCategoryIconUrls('https://example.com/icon.png')).toEqual([
    'https://example.com/icon.png',
  ]);
  expect(
    resolveCategoryIconUrls(
      '/public/categories/icons/expense_transport.png',
    )[0],
  ).toBe(`${API_BASE_URLS[0]}/public/categories/icons/expense_transport.png`);
});
