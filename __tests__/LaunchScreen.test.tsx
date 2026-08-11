import React from 'react';
import { Image } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import LaunchScreen from '../src/screens/auth/LaunchScreen';

declare const __dirname: string;
declare const require: (moduleName: string) => any;

const fs = require('fs');
const path = require('path');

test('uses an optimized PNG for the launch logo', () => {
  const screenPath = path.join(
    __dirname,
    '../src/screens/auth/LaunchScreen.tsx',
  );
  const screenSource = fs.readFileSync(screenPath, 'utf8');
  const assetMatch = screenSource.match(/require\('([^']+\.png)'\)/);

  expect(assetMatch).not.toBeNull();

  const assetPath = path.resolve(path.dirname(screenPath), assetMatch![1]);
  const asset = fs.readFileSync(assetPath);
  const width = asset.readUInt32BE(16);
  const height = asset.readUInt32BE(20);

  expect(asset.byteLength).toBeLessThan(100_000);
  expect(width).toBeLessThanOrEqual(256);
  expect(height).toBeLessThanOrEqual(256);
});

test('keeps the launch screen visible for two seconds after the logo loads', async () => {
  jest.useFakeTimers();
  const navigation = { replace: jest.fn() };
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <LaunchScreen navigation={navigation as never} />,
    );
  });

  await ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(navigation.replace).not.toHaveBeenCalled();

  await ReactTestRenderer.act(() => {
    renderer!.root.findByType(Image).props.onLoad();
  });

  await ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(1_999);
  });
  expect(navigation.replace).not.toHaveBeenCalled();

  await ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(navigation.replace).toHaveBeenCalledWith('Onboarding');

  await ReactTestRenderer.act(() => {
    renderer!.unmount();
  });
  jest.useRealTimers();
});
