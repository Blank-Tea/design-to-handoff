import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { SKILLS, LEGACY_SKILLS, install } from './installer.mjs';

export const TAGS_URL = 'https://api.github.com/repos/Blank-Tea/design-to-handoff/git/matching-refs/tags/v';
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function compareVersions(a, b) {
  if (!VERSION.test(a) || !VERSION.test(b)) throw new Error('Invalid stable version.');
  const left = a.split('.').map(BigInt), right = b.split('.').map(BigInt);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

export async function latestVersion({ url = TAGS_URL, signal, timeout = 15000 } = {}) {
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
  let response;
  try {
    response = await fetch(url, { signal: requestSignal, headers: {
      Accept: 'application/vnd.github+json', 'User-Agent': 'design-to-handoff-updater',
      'X-GitHub-Api-Version': '2022-11-28',
    } });
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    const refs = await response.json();
    if (!Array.isArray(refs)) throw new Error('Invalid GitHub tag response');
    const versions = refs.map(item => typeof item?.ref === 'string' && item.ref.startsWith('refs/tags/v') ? item.ref.slice('refs/tags/v'.length) : '')
      .filter(value => VERSION.test(value));
    if (!versions.length) throw new Error('No stable release tags found');
    return versions.sort(compareVersions).at(-1);
  } catch (cause) {
    signal?.throwIfAborted();
    throw new Error(`无法检查最新版本，现有安装保持不变：${cause.message}`, { cause });
  }
}

async function present(file) {
  try { await fs.lstat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function installedTargets(plan) {
  const installed = [];
  for (const agent of plan) {
    for (const name of [...SKILLS, ...LEGACY_SKILLS]) {
      if (await present(path.join(agent.directory, name))) { installed.push(agent); break; }
    }
  }
  return installed;
}

export async function pendingTargets(plan, version) {
  const pending = [];
  for (const agent of plan) {
    const marker = path.join(agent.directory, 'design-to-handoff', 'version.json');
    let installed;
    try { installed = JSON.parse(await fs.readFile(marker, 'utf8')).version; }
    catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`无法读取安装版本：${marker}`, { cause: error });
    }
    if (installed !== undefined && !VERSION.test(installed)) throw new Error(`安装版本记录无效：${marker}`);
    const legacy = (await Promise.all(LEGACY_SKILLS.map(name => present(path.join(agent.directory, name))))).some(Boolean);
    if (installed === undefined || compareVersions(installed, version) < 0 || (legacy && installed === version)) pending.push(agent);
  }
  return pending;
}

export async function resolveNpmCli({ env = process.env, platform = process.platform, execPath = process.execPath } = {}) {
  const candidates = [
    env.npm_execpath,
    path.join(path.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(path.dirname(execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);
  for (const directory of (env.PATH || '').split(path.delimiter)) {
    if (!directory) continue;
    const launcher = path.join(directory, platform === 'win32' ? 'npm.cmd' : 'npm');
    try {
      const actual = await fs.realpath(launcher);
      candidates.push(actual.endsWith('npm-cli.js') ? actual : path.join(path.dirname(actual), 'node_modules', 'npm', 'bin', 'npm-cli.js'));
    } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
  }
  for (const candidate of candidates) if (candidate.endsWith('npm-cli.js') && await present(candidate)) return candidate;
  throw new Error('找不到 npm-cli.js，请使用配套提供 npm 的 Node.js 22.20+。');
}

export async function runNode(file, args, { signal, capture = false, env = process.env } = {}) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { signal, env, windowsHide: true,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let output = '', errorOutput = '';
    if (capture) {
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', chunk => { errorOutput += chunk; });
    }
    child.once('error', reject);
    child.once('close', (code, childSignal) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(`命令执行失败（${code ?? childSignal}）${capture ? ': ' + errorOutput.trim() : ''}`));
    });
  });
}

export function globalPackageDirectory(prefix, platform = process.platform) {
  return platform === 'win32' ? path.join(prefix, 'node_modules', 'design-to-handoff')
    : path.join(prefix, 'lib', 'node_modules', 'design-to-handoff');
}

export async function updateInstallation({ source, plan, currentVersion, dryRun = false, signal,
  check = latestVersion, upgrade, log = console.log } = {}) {
  const targets = await installedTargets(plan);
  if (!targets.length) throw new Error('未找到已安装的 design-to-handoff。请先运行 design-to-handoff 安装，或指定原安装的 --scope / --root。');
  const latest = await check({ signal });
  const newer = compareVersions(latest, currentVersion) > 0;
  const targetVersion = newer ? latest : currentVersion;
  const pending = await pendingTargets(targets, targetVersion);
  if (!newer && !pending.length) {
    log(`已是最新版本 ${currentVersion}，无需下载或重新安装。`);
    return { status: 'current', version: currentVersion, installed: 0 };
  }
  log(`当前命令版本 ${currentVersion}；最新发布版本 ${latest}。`);
  targets.forEach(agent => log(`  ${agent.label}: ${agent.directory}`));
  if (dryRun) {
    log('Dry run; no files written.');
    return { status: 'dry-run', version: targetVersion, installed: 0 };
  }
  signal?.throwIfAborted();
  if (newer) {
    if (!upgrade) throw new Error('缺少命令行升级能力，现有技能未更改。');
    // Finish the package download/upgrade before touching any installed skill.
    await upgrade(latest, targets);
    return { status: 'upgraded', version: latest };
  }
  const result = await install(source, pending, { allowReplace: true, signal });
  log(`更新完成：${currentVersion}，已更新 ${result.installed} 个智能体；原文件已备份。`);
  return { ...result, status: 'synced', version: currentVersion };
}
