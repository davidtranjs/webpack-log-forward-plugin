import vm from 'node:vm';
import { WebpackLogForwardPlugin } from '../index';

describe('console proxy', () => {
  it('forwards logs after reassignment', async () => {
    const plugin = new WebpackLogForwardPlugin();
    const script = (plugin as any).generateLogForwardScript();

    const fetchMock = jest.fn().mockResolvedValue({ status: 200 });

    const sandbox: any = {
      console: {
        log: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      },
      fetch: fetchMock,
      AbortController: class {
        signal = {};
        abort() {}
      },
      setTimeout: (fn: any) => {
        fn();
        return 1;
      },
      clearTimeout: () => {},
      requestAnimationFrame: (cb: any) => cb(),
      document: {
        createElement: jest.fn(() => ({
          style: {},
          remove: jest.fn(),
          set textContent(_v: string) {}
        })),
        body: { appendChild: jest.fn() }
      },
      location: { search: '' },
      addEventListener: jest.fn()
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);

    vm.runInContext(script, sandbox);

    sandbox.console.log('first');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const newLog = jest.fn();
    sandbox.console.log = newLog;
    sandbox.console.log('second');
    expect(newLog).toHaveBeenCalledWith('second');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
