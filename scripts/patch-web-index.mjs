// scripts/patch-web-index.mjs
// `expo export -p web` writes a bare dist/index.html (title "oxxito-app", no
// manifest). This adds what the published site needs: the Conoxxo title, the
// theme color and the icon/manifest links under the web base path: /oxxitoapp on
// GitHub Pages, the root on Cloudflare (EXPO_BASE_URL, as in app.config.js).
// Usage: node scripts/patch-web-index.mjs [dist/index.html]
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] || 'dist/index.html';
const BASE = process.env.EXPO_BASE_URL !== undefined ? process.env.EXPO_BASE_URL : '/oxxitoapp';
let html = readFileSync(file, 'utf8');

if (!/<title>[^<]*<\/title>/.test(html) || !html.includes('</head>')) {
  throw new Error(`${file}: no <title> or </head> to patch`);
}
html = html.replace(/<title>[^<]*<\/title>/, '<title>Conoxxo</title>\n    <meta name="theme-color" content="#E30613" />');
html = html.replace(
  '</head>',
  [
    `  <link rel="icon" href="${BASE}/icon-192.png" />`,
    `  <link rel="manifest" href="${BASE}/manifest.json" />`,
    `  <link rel="apple-touch-icon" href="${BASE}/apple-touch-icon.png" />`,
    // iPhone Safari zooms the page in when a field with text under 16px gets
    // focus, and does not zoom back out. Touch screens get 16px fields; pinch
    // zoom stays available (no maximum-scale in the viewport).
    `  <style>@media (hover: none) and (pointer: coarse) { input, textarea, select { font-size: 16px !important; } }</style></head>`,
  ].join('\n')
);
writeFileSync(file, html);
console.log(`patched ${file}`);
