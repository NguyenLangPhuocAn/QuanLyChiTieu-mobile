import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
} from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createSharedProvider } from '../src/context/sharedProvider';
it('shares one controller across roots, propagates changes and hands ownership over on close', async () => {
  const Context = createContext<
    { name: string; change: (v: string) => void } | undefined
  >(undefined);
  let boots = 0,
    stops = 0;
  const Controller = ({
    publish,
    children,
  }: React.PropsWithChildren<{
    publish: (v: React.ContextType<typeof Context>) => void;
  }>) => {
    const [name, change] = useState('cached');
    useLayoutEffect(() => {
      boots++;
      return () => {
        stops++;
      };
    }, []);
    const value = { name, change };
    useLayoutEffect(() => publish(value));
    return <Context.Provider value={value}>{children}</Context.Provider>;
  };
  // The test controller publishes only defined values, as AuthController does.
  const Provider = createSharedProvider(Context, Controller);
  const seen: Record<string, React.ContextType<typeof Context>> = {};
  const Probe = ({ id }: { id: string }) => {
    seen[id] = useContext(Context);
    return null;
  };
  let a!: TestRenderer.ReactTestRenderer, b!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    a = TestRenderer.create(
      <Provider>
        <Probe id="a" />
      </Provider>,
    );
  });
  await act(async () => {
    b = TestRenderer.create(
      <Provider>
        <Probe id="b" />
      </Provider>,
    );
  });
  expect(boots).toBe(1);
  expect(seen.a).toBe(seen.b);
  await act(async () => seen.b!.change('signed-out'));
  expect(seen.a!.name).toBe('signed-out');
  await act(async () => a.unmount());
  expect(stops).toBe(1);
  expect(boots).toBe(2);
  expect(seen.b!.name).toBe('cached');
  await act(async () => b.unmount());
  expect(stops).toBe(2);
});

it('keeps a widget draft mounted when the main root closes and hands over its controller', async () => {
  const Context = createContext<{ ready: boolean } | undefined>(undefined);
  const Controller = ({
    publish,
    children,
  }: React.PropsWithChildren<{
    publish: (value: { ready: boolean }) => void;
  }>) => {
    useLayoutEffect(() => publish({ ready: true }), [publish]);
    return (
      <Context.Provider value={{ ready: true }}>{children}</Context.Provider>
    );
  };
  const Provider = createSharedProvider(Context, Controller);
  let draft = '',
    change!: (value: string) => void,
    mounts = 0;
  const WidgetDraft = () => {
    const [text, setText] = useState('');
    draft = text;
    change = setText;
    useLayoutEffect(() => {
      mounts++;
    }, []);
    return null;
  };
  let main!: TestRenderer.ReactTestRenderer,
    widget!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    main = TestRenderer.create(<Provider />);
  });
  await act(async () => {
    widget = TestRenderer.create(
      <Provider>
        <WidgetDraft />
      </Provider>,
    );
  });
  await act(async () => change('Grab 25.000'));
  await act(async () => main.unmount());
  expect(draft).toBe('Grab 25.000');
  expect(mounts).toBe(1);
  await act(async () => widget.unmount());
});
