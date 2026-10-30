// scripts/patch-web-index.mjs
// `expo export -p web` writes a bare dist/index.html (title "oxxito-app", no
// manifest). This adds what the published site needs: the Conoxxo title, the
// theme color and the icon/manifest links under the /oxxitoapp/ base path.
// Usage: node scripts/patch-web-index.mjs [dist/index.html]
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] || 'dist/index.html';
const BASE = '/oxxitoapp';
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
    `  <link rel="apple-touch-icon" href="${BASE}/apple-touch-icon.png" /></head>`,
  ].join('\n')
);
writeFileSync(file, html);
console.log(`patched ${file}`);
