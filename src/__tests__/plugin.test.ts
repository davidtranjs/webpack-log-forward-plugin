import { type LogForwardOptions, type LogType, WebpackLogForwardPlugin } from '../index';

describe('WebpackLogForwardPlugin', () => {
  let mockCompiler: any;
  let mockCompilation: any;
  let mockDevServer: any;

  beforeEach(() => {
    mockCompilation = {
      hooks: {
        additionalAssets: {
          tap: jest.fn((_name, callback) => {
            callback();
          })
        },
        processAssets: {
          tap: jest.fn((_options, callback) => {
            callback({});
          })
        }
      },
      assets: {}
    };

    mockDevServer = {
      setupMiddlewares: jest.fn(),
      before: jest.fn()
    };

    mockCompiler = {
      options: {
        mode: 'development',
        devServer: mockDevServer
      },
      hooks: {
        afterCompile: {
          tap: jest.fn((_name, callback) => {
            callback(mockCompilation);
          })
        },
        afterEnvironment: {
          tap: jest.fn((_name, callback) => {
            callback();
          })
        },
        thisCompilation: {
          tap: jest.fn((_name, callback) => {
            callback(mockCompilation);
          })
        }
      }
    };
  });

  describe('constructor', () => {
    it('should set default options when no options provided', () => {
      const plugin = new WebpackLogForwardPlugin();
      expect(plugin).toBeDefined();
    });

    it('should accept custom options', () => {
      const options: LogForwardOptions = {
        logTypes: ['error', 'warn'],
        prefix: '[Custom]',
        includeTimestamp: false,
        enabled: true
      };
      const plugin = new WebpackLogForwardPlugin(options);
      expect(plugin).toBeDefined();
    });
  });

  describe('apply', () => {
    it('should not apply in production mode', () => {
      mockCompiler.options.mode = 'production';
      const plugin = new WebpackLogForwardPlugin();
      plugin.apply(mockCompiler);

      expect(mockCompiler.hooks.thisCompilation.tap).not.toHaveBeenCalled();
    });

    it('should not apply when dev server is not configured', () => {
      mockCompiler.options.devServer = undefined;
      const plugin = new WebpackLogForwardPlugin();
      plugin.apply(mockCompiler);

      expect(mockCompiler.hooks.thisCompilation.tap).not.toHaveBeenCalled();
    });

    it('should not apply when plugin is disabled', () => {
      const plugin = new WebpackLogForwardPlugin({ enabled: false });
      plugin.apply(mockCompiler);

      expect(mockCompiler.hooks.thisCompilation.tap).not.toHaveBeenCalled();
    });

    it('should apply in development mode with dev server', () => {
      const plugin = new WebpackLogForwardPlugin();
      plugin.apply(mockCompiler);

      expect(mockCompiler.hooks.thisCompilation.tap).toHaveBeenCalledWith(
        'WebpackLogForwardPlugin',
        expect.any(Function)
      );
    });
  });

  describe('log types configuration', () => {
    it('should default to all log types', () => {
      const plugin = new WebpackLogForwardPlugin();
      expect(plugin.getOptions().logTypes).toEqual(['log', 'info', 'warn', 'error', 'debug']);
    });

    it('should accept custom log types', () => {
      const customLogTypes: LogType[] = ['error', 'warn'];
      const plugin = new WebpackLogForwardPlugin({ logTypes: customLogTypes });
      expect(plugin.getOptions().logTypes).toEqual(customLogTypes);
    });
  });

  describe('prefix configuration', () => {
    it('should default to [Browser]', () => {
      const plugin = new WebpackLogForwardPlugin();
      expect(plugin.getOptions().prefix).toBe('[Browser]');
    });

    it('should accept custom prefix', () => {
      const customPrefix = '[MyApp]';
      const plugin = new WebpackLogForwardPlugin({ prefix: customPrefix });
      expect(plugin.getOptions().prefix).toBe(customPrefix);
    });
  });

  describe('timestamp configuration', () => {
    it('should default to include timestamp', () => {
      const plugin = new WebpackLogForwardPlugin();
      expect(plugin.getOptions().includeTimestamp).toBe(true);
    });

    it('should accept custom timestamp setting', () => {
      const plugin = new WebpackLogForwardPlugin({ includeTimestamp: false });
      expect(plugin.getOptions().includeTimestamp).toBe(false);
    });
  });
});
