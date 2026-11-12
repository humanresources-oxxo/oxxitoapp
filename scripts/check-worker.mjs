// scripts/check-worker.mjs
// Syntax check of every file in worker/ (they are plain JavaScript, so tsc
// does not look at them). Used by .github/workflows/revisar.yml.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const archivos = readdirSync('worker').filter((f) => f.endsWith('.js'));
let fallas = 0;
for (const f of archivos) {
  const r = spawnSync(process.execPath, ['--check', `worker/${f}`], { stdio: 'inherit' });
  if (r.status !== 0) fallas++;
}
console.log(`worker/: ${archivos.length} archivos, ${fallas} con errores`);
process.exit(fallas ? 1 : 0);
