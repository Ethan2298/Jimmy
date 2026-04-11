import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtime = (process.argv[2] || 'electron').toLowerCase();

if (runtime !== 'electron' && runtime !== 'node') {
  console.error(`Unsupported runtime "${runtime}". Use "electron" or "node".`);
  process.exit(1);
}

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptsDir, '..');
const moduleDir = resolve(rootDir, 'node_modules', 'better-sqlite3');
const prebuildInstall = resolve(rootDir, 'node_modules', 'prebuild-install', 'bin.js');
const nodeGyp = resolve(rootDir, 'node_modules', '@electron', 'node-gyp', 'bin', 'node-gyp.js');

if (!existsSync(moduleDir)) {
  console.error('better-sqlite3 is not installed. Run npm install first.');
  process.exit(1);
}

let target = null;
if (runtime === 'electron') {
  const electronPkg = resolve(rootDir, 'node_modules', 'electron', 'package.json');
  if (!existsSync(electronPkg)) {
    console.error('electron is not installed. Run npm install first.');
    process.exit(1);
  }
  target = JSON.parse(readFileSync(electronPkg, 'utf8')).version;
}

const commonArgs = [];
commonArgs.push(`--runtime=${runtime}`);
if (target) {
  commonArgs.push(`--target=${target}`);
}
if (runtime === 'electron') {
  commonArgs.push('--dist-url=https://electronjs.org/headers');
}

const runNode = (args, cwd) => {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' });
  if (result.error) {
    console.error(result.error);
    return result.status ?? 1;
  }
  return result.status ?? 1;
};

const prebuildArgs = [prebuildInstall, ...commonArgs, '--tag-prefix=v'];
let status = runNode(prebuildArgs, moduleDir);

if (status !== 0) {
  console.error('prebuild-install failed, falling back to node-gyp rebuild.');
  const gypArgs = [nodeGyp, 'rebuild', ...commonArgs, '--build-from-source', '--release'];
  status = runNode(gypArgs, moduleDir);
}

process.exit(status);
