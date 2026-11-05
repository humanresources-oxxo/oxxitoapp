// app.config.js
// Same config as app.json; only the web base path can change. GitHub Pages
// serves the app under /oxxitoapp (app.json); Cloudflare serves it at the root
// (npm run build:cloudflare sets EXPO_BASE_URL to an empty string).
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_BASE_URL !== undefined ? process.env.EXPO_BASE_URL : config.experiments.baseUrl,
  },
});
