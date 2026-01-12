const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure server for cloudflare tunnel usage
if (process.env.EXPO_PUBLIC_URL) {
  config.server = {
    ...config.server,
    port: 8081,
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Rewrite the host header for proper URL generation
        if (process.env.EXPO_PUBLIC_URL) {
          const publicUrl = new URL(process.env.EXPO_PUBLIC_URL);
          req.headers.host = publicUrl.host;
        }
        return middleware(req, res, next);
      };
    },
  };
}

module.exports = config;
