import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useSingleFlight } from '../src/hooks/useSingleFlight';

it('allows only one same-frame submission and unlocks after success or failure', async () => {
  let current!: ReturnType<typeof useSingleFlight>;
  const Probe = () => {
    current = useSingleFlight();
    return null;
  };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(() => {
    renderer = ReactTestRenderer.create(<Probe />);
  });
  let resolve!: () => void;
  const operation = jest.fn(
    () =>
      new Promise<void>(done => {
        resolve = done;
      }),
  );
  let first!: Promise<void | undefined>;
  await act(() => {
    first = current.run(operation);
    current.run(operation).catch(() => undefined);
  });
  expect(operation).toHaveBeenCalledTimes(1);
  expect(current.busy).toBe(true);
  await act(async () => {
    resolve();
    await first;
  });
  expect(current.busy).toBe(false);
  await act(async () => {
    await expect(
      current.run(async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
  });
  expect(current.busy).toBe(false);
  const next = jest.fn().mockResolvedValue('done');
  await act(async () => {
    await current.run(next);
  });
  expect(next).toHaveBeenCalledTimes(1);
  await act(() => renderer.unmount());
});
