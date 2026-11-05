// scripts/build-cloudflare.mjs
// Web build for Cloudflare (wrangler.jsonc -> dist/): the same steps as the
// GitHub Pages workflow (.github/workflows/deploy-web.yml) but with the app at
// the root of the domain instead of /oxxitoapp. Cloudflare's build command:
// npm run build:cloudflare
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';

// Publishable values, the same defaults as deploy-web.yml (they end up in the
// public bundle anyway); a Cloudflare build variable with the same name wins.
const env = {
  ...process.env,
  EXPO_BASE_URL: '',
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gceuazxrqdbfahtdieod.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_59I8XugqRxE-LUhMSqmiEQ_HNzD7CRK',
};
const run = (cmd) => execSync(cmd, { stdio: 'inherit', env });

run('npx tsc --noEmit');
run('npx expo export -p web --output-dir dist --clear');
run('node scripts/patch-web-index.mjs dist/index.html');
mkdirSync('dist/admin', { recursive: true });
cpSync('admin/index.html', 'dist/admin/index.html');
writeFileSync('dist/version.txt', `${process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || 'local'}\n`);
console.log('dist/ listo para Cloudflare');
