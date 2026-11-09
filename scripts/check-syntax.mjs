import { readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_TARGETS = [
  'frontend/js',
  'frontend/config.js',
  'frontend/test',
  'backend/src',
  'backend/test',
  'scripts',
];

const targets = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_TARGETS;
const files = [];
let missing = 0;

function collect(target) {
  let stats;
  try {
    stats = statSync(target);
  } catch {
    console.error(`Missing path: ${target}`);
    missing += 1;
    return;
  }
  if (stats.isDirectory()) {
    for (const name of readdirSync(target).sort()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      collect(join(target, name));
    }
    return;
  }
  if (['.js', '.mjs', '.cjs'].includes(extname(target))) files.push(target);
}

for (const target of targets) collect(target);

let failed = 0;
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    failed += 1;
    console.error(`✗ Syntax error: ${relative(process.cwd(), file) || file}`);
  }
}

if (missing > 0) {
  console.error(`Syntax check aborted: ${missing} path(s) not found.`);
  process.exit(1);
}
if (failed > 0) {
  console.error(`Syntax check failed: ${failed} of ${files.length} file(s).`);
  process.exit(1);
}
console.log(`Syntax OK: ${files.length} file(s).`);