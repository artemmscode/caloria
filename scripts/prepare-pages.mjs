import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'frontend');
const output = path.join(root, process.env.PAGES_OUTPUT_DIR || 'dist');

function fail(message) {
  console.error(`\n[prepare-pages] ${message}\n`);
  process.exit(1);
}

const apiBase = (process.env.API_BASE_URL || '').trim().replace(/\/+$/, '');
const botUsername = (process.env.BOT_USERNAME || '').trim().replace(/^@/, '');

if (!apiBase) {
  fail(
    'API_BASE_URL is empty. Add a repository Variable API_BASE_URL (for example ' +
      'https://caloria-api.onrender.com) in Settings → Secrets and variables → Actions → Variables.',
  );
}

let parsed;
try {
  parsed = new URL(apiBase);
} catch {
  fail(`API_BASE_URL is not a valid URL: ${apiBase}`);
}
if (parsed.protocol !== 'https:') {
  fail('API_BASE_URL must use HTTPS: Telegram Mini Apps and GitHub Pages require a secure backend URL.');
}
if (/(^|\.)localhost$|^127\.|^0\.0\.0\.0$|\.local$/i.test(parsed.hostname)) {
  fail('API_BASE_URL must not point to localhost. Use the public Render URL.');
}

if (!existsSync(source)) fail('frontend/ directory is missing.');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

// Test files and the package manifest are development-only.
await rm(path.join(output, 'test'), { recursive: true, force: true });
await rm(path.join(output, 'package.json'), { force: true });

const configPath = path.join(output, 'config.js');
let config = await readFile(configPath, 'utf8');
if (!config.includes("'__API_BASE_URL__'")) {
  fail('frontend/config.js no longer contains the __API_BASE_URL__ placeholder.');
}
config = config.replaceAll("'__API_BASE_URL__'", `'${apiBase}'`);
if (botUsername) {
  config = config.replaceAll("'__BOT_USERNAME__'", `'${botUsername}'`);
}
await writeFile(configPath, config, 'utf8');

// GitHub Pages serves the artifact with Jekyll disabled and keeps relative paths
// working from /<repository>/ without extra build steps.
await writeFile(path.join(output, '.nojekyll'), '', 'utf8');

console.log('[prepare-pages] Static site ready');
console.log(`  output:    ${path.relative(root, output)}/`);
console.log(`  API_BASE_URL: ${apiBase}`);
console.log(`  BOT_USERNAME: ${botUsername ? `@${botUsername}` : '(not set — bot link hidden)'}`);