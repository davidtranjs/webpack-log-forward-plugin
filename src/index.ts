import { Compilation, type Compiler, sources, type WebpackPluginInstance } from 'webpack';

export type LogType = 'log' | 'info' | 'warn' | 'error' | 'debug';

export interface LogForwardOptions {
  /**
   * Array of log types to forward. Defaults to all types: ['log', 'info', 'warn', 'error', 'debug']
   */
  logTypes?: LogType[];
  /**
   * Whether to enable the plugin. Defaults to true.
   */
  enabled?: boolean;
  /**
   * Custom prefix for forwarded logs. Defaults to '[Browser]'.
   */
  prefix?: string;
  /**
   * Whether to include timestamp in forwarded logs. Defaults to true.
   */
  includeTimestamp?: boolean;
}

export class WebpackLogForwardPlugin implements WebpackPluginInstance {
  private options: Required<LogForwardOptions>;

  constructor(options: LogForwardOptions = {}) {
    this.options = {
      logTypes: options.logTypes || ['log', 'info', 'warn', 'error', 'debug'],
      enabled: options.enabled !== false,
      prefix: options.prefix || '[Browser]',
      includeTimestamp: options.includeTimestamp !== false
    };
  }

  // Public getter for testing purposes
  getOptions(): Required<LogForwardOptions> {
    return { ...this.options };
  }

  apply(compiler: Compiler): void {
    // Only apply in development mode
    if (compiler.options.mode !== 'development') {
      return;
    }

    if (!this.options.enabled) {
      return;
    }

    if (!compiler.options.devServer) {
      // add log to tell user should not use this plugin in production
      console.warn(
        '[WebpackLogForwardPlugin] This plugin suppose to be used with webpack dev server only, please DO NOT use it in production mode'
      );
      return;
    }

    // Log that plugin is active and logs will be forwarded
    console.log(
      `[WebpackLogForwardPlugin] Plugin enabled! Browser logs will be forwarded to console. Log types: ${this.options.logTypes.join(', ')}`
    );

    // Setup webpack dev server middleware
    this.setupDevServerMiddleware(compiler);

    // Inject the log forwarding code at the beginning of each chunk
    compiler.hooks.thisCompilation.tap('WebpackLogForwardPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'WebpackLogForwardPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE
        },
        (assets) => {
          const logForwardScript = this.generateLogForwardScript();

          // Add the script to all JS assets
          Object.keys(assets).forEach((assetName) => {
            if (assetName.endsWith('.js')) {
              const asset = assets[assetName];
              const newSource = new sources.ConcatSource(
                new sources.RawSource(`${logForwardScript}\n`),
                asset
              );
              compilation.updateAsset(assetName, newSource);
            }
          });
        }
      );
    });
  }

  private generateLogForwardScript(): string {
    const { logTypes, prefix, includeTimestamp } = this.options;

    return `
(function() {
  'use strict';
  
  const logTypes = ${JSON.stringify(logTypes)};
  const prefix = ${JSON.stringify(prefix)};
  const includeTimestamp = ${JSON.stringify(includeTimestamp)};
  
  function getTimestamp() {
    return includeTimestamp ? new Date().toISOString() + ' ' : '';
  }
  
  function forwardLog(type, args) {
    // Check if logging is enabled for this type
    if (!logTypes.includes(type)) return;
    
    try {
      const timestamp = getTimestamp();
      const message = Array.from(args).map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      // Only send if we have a message
      if (!message.trim()) return;
      
      const logData = {
        type: type,
        message: message,
        timestamp: timestamp,
        prefix: prefix
      };
      
      // Send to server via fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
      
      fetch('/__webpack_log_forward__', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
        signal: controller.signal
      }).then(response => {
        clearTimeout(timeoutId);
        // Check if debug mode is enabled in a safe way
        if (window.location.search.includes('debug=true')) {
          const debugLog = document.createElement('div');
          debugLog.textContent = '[DEBUG] Log forwarded: ' + type + ' - ' + response.status;
          debugLog.style.cssText = 'position:fixed;top:0;right:0;background:black;color:white;padding:2px;font-size:10px;z-index:999999;';
          document.body?.appendChild(debugLog);
          setTimeout(() => debugLog.remove(), 2000);
        }
      }).catch(error => {
        clearTimeout(timeoutId);
      });
    } catch (e) {
      // Silently ignore any errors in log forwarding
    }
  }
  
    // Install a Proxy to keep forwarding active even if console methods are reassigned
    if (!window._webpackLogForwardInstalled) {
      window._webpackLogForwardInstalled = true;

      const consoleProxy = new Proxy(console, {
        get(target, prop) {
          const original = target[prop];
          if (logTypes.includes(prop) && typeof original === 'function') {
            return (...args) => {
              original.apply(target, args);
              forwardLog(prop, args);
            };
          }
          return typeof original === 'function' ? original.bind(target) : original;
        },
        set(target, prop, value) {
          target[prop] = value;
          return true;
        }
      });

      window.console = consoleProxy;
    }
  
  // Also provide a clean API for manual logging
  window.webpackLog = {
    log: (...args) => { console.log(...args); },
    info: (...args) => { console.info(...args); },
    warn: (...args) => { console.warn(...args); },
    error: (...args) => { console.error(...args); },
    debug: (...args) => { console.debug(...args); }
  };
  
  // Also handle unhandled errors
  window.addEventListener('error', function(event) {
    forwardLog('error', [event.error || event.message]);
  });
  
  window.addEventListener('unhandledrejection', function(event) {
    forwardLog('error', [event.reason]);
  });
})();
`;
  }

  private setupDevServerMiddleware(compiler: Compiler): void {
    const devServerOptions = compiler.options.devServer;
    if (devServerOptions) {
      console.log('WebpackLogForwardPlugin: Setting up middleware...');

      // Use onBeforeSetupMiddleware if available (older webpack-dev-server versions)
      if (!devServerOptions.setupMiddlewares) {
        devServerOptions.onBeforeSetupMiddleware = (devServer: any) => {
          devServer.app.post('/__webpack_log_forward__', (req: any, res: any) => {
            let body = '';
            req.on('data', (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                const logData = JSON.parse(body);
                this.forwardLogToTerminal(logData);
                res.json({ success: true });
              } catch (error) {
                console.error('Log forward error:', error);
                res.status(400).json({ error: 'Invalid JSON' });
              }
            });
          });
        };
      } else {
        // Store reference to the original setupMiddlewares function
        const originalSetupMiddlewares = devServerOptions.setupMiddlewares;

        // Override setupMiddlewares to add our middleware
        devServerOptions.setupMiddlewares = (middlewares: any, devServer: any) => {
          // Add middleware directly to express app if available
          if (devServer.app) {
            devServer.app.post('/__webpack_log_forward__', (req: any, res: any) => {
              let body = '';
              req.on('data', (chunk: Buffer) => {
                body += chunk.toString();
              });
              req.on('end', () => {
                try {
                  const logData = JSON.parse(body);
                  this.forwardLogToTerminal(logData);
                  res.json({ success: true });
                } catch (error) {
                  console.error('Log forward error:', error);
                  res.status(400).json({ error: 'Invalid JSON' });
                }
              });
            });
          }

          // Also try the middleware approach
          middlewares.unshift({
            name: 'webpack-log-forward',
            path: '/__webpack_log_forward__',
            middleware: (req: any, res: any, next: any) => {
              if (req.method === 'POST' && req.url === '/__webpack_log_forward__') {
                let body = '';
                req.on('data', (chunk: Buffer) => {
                  body += chunk.toString();
                });
                req.on('end', () => {
                  try {
                    const logData = JSON.parse(body);
                    this.forwardLogToTerminal(logData);
                    res.writeHead(200, {
                      'Content-Type': 'application/json',
                      'Access-Control-Allow-Origin': '*',
                      'Access-Control-Allow-Methods': 'POST',
                      'Access-Control-Allow-Headers': 'Content-Type'
                    });
                    res.end(JSON.stringify({ success: true }));
                  } catch (error) {
                    console.error('Log forward error:', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                  }
                });
              } else {
                next();
              }
            }
          });

          // Call the original setupMiddlewares if it exists
          if (originalSetupMiddlewares) {
            return originalSetupMiddlewares(middlewares, devServer);
          }

          return middlewares;
        };
      }
    }
  }

  private forwardLogToTerminal(logData: any): void {
    const { type, message, timestamp, prefix } = logData;

    // Color codes for different log types
    const colors = {
      log: '\x1b[36m', // Cyan
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      debug: '\x1b[35m' // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[type as keyof typeof colors] || colors.log;

    const timestampStr = timestamp || '';
    const logMessage = `${color}${prefix} ${type.toUpperCase()}:${reset} ${timestampStr}${message}`;

    // Use console methods to maintain proper formatting
    switch (type) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'debug':
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }
}

export default WebpackLogForwardPlugin;
