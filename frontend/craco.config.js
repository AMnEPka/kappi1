// craco.config.js
const path = require("path");
require("dotenv").config();

// Environment variable overrides
const config = {
  disableHotReload: process.env.DISABLE_HOT_RELOAD === "true",
  enableVisualEdits: process.env.REACT_APP_ENABLE_VISUAL_EDITS === "true",
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load visual editing modules only if enabled
let babelMetadataPlugin;
let setupDevServer;

if (config.enableVisualEdits) {
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
}

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

const webpackConfig = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      const NOISY_SOURCE_MAP_MODULES = ["dompurify", "docx-preview", "xlsx"];
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        (warning) => {
          const message = warning?.message || "";
          const file = warning?.file || "";
          if (typeof message !== "string" || !message.includes("Failed to parse source map")) {
            return false;
          }
          return NOISY_SOURCE_MAP_MODULES.some(
            (name) => message.includes(name) || file.includes(name),
          );
        },
      ];

      // Exclude noisy modules from source-map-loader.
      // They ship sourcemaps referencing TS sources that are not included in the package,
      // which triggers "Failed to parse source map" warnings.
      try {
        const excludePatterns = NOISY_SOURCE_MAP_MODULES.map(
          (name) => new RegExp(`[\\\\/]node_modules[\\\\/]${name}[\\\\/]`),
        );

        const visit = (rulesArray) => {
          if (!Array.isArray(rulesArray)) return;
          rulesArray.forEach((rule) => {
            if (!rule) return;
            if (Array.isArray(rule.oneOf)) visit(rule.oneOf);
            if (Array.isArray(rule.rules)) visit(rule.rules);

            const uses = rule.use ? (Array.isArray(rule.use) ? rule.use : [rule.use]) : [];
            const hasSourceMapLoader = uses.some((u) => {
              const loader = typeof u === "string" ? u : u?.loader;
              return loader && loader.includes("source-map-loader");
            });
            if (!hasSourceMapLoader) return;

            if (rule.exclude == null) {
              rule.exclude = [...excludePatterns];
              return;
            }
            rule.exclude = Array.isArray(rule.exclude)
              ? [...rule.exclude, ...excludePatterns]
              : [rule.exclude, ...excludePatterns];
          });
        };
        visit(webpackConfig?.module?.rules);
      } catch (e) {
        // If webpack internals change, don't break the build.
      }

      // Disable hot reload completely if environment variable is set
      if (config.disableHotReload) {
        // Remove hot reload related plugins
        webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
          return !(plugin.constructor.name === 'HotModuleReplacementPlugin');
        });

        // Disable watch mode
        webpackConfig.watch = false;
        webpackConfig.watchOptions = {
          ignored: /.*/, // Ignore all files
        };
      } else {
        // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
          ],
        };
      }

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      return webpackConfig;
    },
  },
};

// Only add babel plugin if visual editing is enabled
if (config.enableVisualEdits) {
  webpackConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

// Setup dev server configuration
webpackConfig.devServer = (devServerConfig) => {
  // When DISABLE_HOT_RELOAD is true, completely disable WebSocket connections
  // This prevents browser from trying to connect to HMR WebSocket through nginx
  if (config.disableHotReload) {
    devServerConfig.hot = false;
    devServerConfig.liveReload = false;
    devServerConfig.webSocketServer = false; // Disable WebSocket server entirely
    devServerConfig.client = false; // Disable client script entirely (no WebSocket, no overlay)
  } else {
    // За reverse-proxy (nginx на :405): клиент HMR подключается к тому же host/port, что и страница, путь /ws
    const client = devServerConfig.client;
    if (client !== false) {
      devServerConfig.client =
        client && typeof client === "object"
          ? { ...client, webSocketURL: "auto:///ws" }
          : { webSocketURL: "auto:///ws" };
    }
  }

  // Apply visual edits dev server setup if enabled
  if (config.enableVisualEdits && setupDevServer) {
    devServerConfig = setupDevServer(devServerConfig);
  }

  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
