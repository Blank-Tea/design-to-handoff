import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AGENTS, buildPlan, install } from '../lib/installer.mjs';
import { compareVersions, latestVersion, updateInstallation, installedTargets, resolveNpmCli, runNode, globalPackageDirectory } from '../lib/updater.mjs';

const source = fileURLToPath(new URL('../skills/', import.meta.url));
const cli = fileURLToPath(new URL('../bin/install.mjs', import.meta.url));
const version = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
async function sandbox(fn) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'handoff-update-'));
  try { await fn(root); } finally { await fs.rm(root, { recursive: true, force: true }); }
}
async function server(fn) {
  let requests = [];
  const http = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, headers: req.headers });
    if (req.url === '/limited') { res.writeHead(403); res.end('{"message":"API rate limit exceeded"}'); return; }
    if (req.url === '/invalid') { res.end('{broken'); return; }
    const send = () => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify([
        { ref: 'refs/tags/v0.3.1' }, { ref: `refs/tags/v${version}` },
        { ref: 'refs/tags/v0.2.9' }, { ref: 'refs/tags/v99.0.0-beta.1' },
      ]));
    };
    if (req.url === '/slow') setTimeout(send, 250); else send();
  });
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${http.address().port}`;
  try { await fn(base, requests); } finally { http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); }
}
const checkAt = url => ({ signal } = {}) => latestVersion({ url, signal });

test('stable version comparison is numeric and rejects malformed versions', () => {
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
  assert.equal(compareVersions(version, version), 0);
  assert.equal(compareVersions('1.0.0', '2.0.0'), -1);
  assert.throws(() => compareVersions('0.5.0;echo bad', version));
  assert.throws(() => compareVersions('01.0.0', version));
});

test('real HTTP version check handles stable refs, errors, invalid JSON and timeout', async () => server(async (base, requests) => {
  assert.equal(await latestVersion({ url: base + '/tags' }), version);
  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].headers.authorization, undefined);
  assert.equal(requests[0].headers.accept, 'application/vnd.github+json');
  await assert.rejects(latestVersion({ url: base + '/limited' }), /HTTP 403/);
  await assert.rejects(latestVersion({ url: base + '/invalid' }), /无法检查最新版本/);
  await assert.rejects(latestVersion({ url: base + '/slow', timeout: 50 }), /无法检查最新版本/);
}));

test('current version performs only metadata check; no download, replacement or backup', async () => sandbox(root => server(async (base, requests) => {
  const plan = buildPlan(['codex'], { root, explicitRoot: true });
  await install(source, plan);
  await fs.writeFile(path.join(plan[0].directory, 'design-to-handoff', 'personal-note.txt'), 'preserve');
  const result = await updateInstallation({ source, plan, currentVersion: version, check: checkAt(base + '/tags'),
    upgrade() { assert.fail('A current version must not download a package'); }, log() {} });
  assert.equal(result.status, 'current');
  assert.equal(requests.length, 1);
  assert.equal(await fs.readFile(path.join(plan[0].directory, 'design-to-handoff', 'personal-note.txt'), 'utf8'), 'preserve');
  await assert.rejects(fs.access(path.join(path.dirname(plan[0].directory), '.design-to-handoff-backups')));
})));

test('all supported installed hosts sync older skills from local CLI without downloading', async () => sandbox(root => server(async (base, requests) => {
  const plan = buildPlan(AGENTS.map(a => a.id), { root, explicitRoot: true });
  await install(source, plan);
  for (const agent of plan) await fs.writeFile(path.join(agent.directory, 'design-to-handoff', 'version.json'), '{"version":"0.4.0"}');
  const result = await updateInstallation({ source, plan, currentVersion: version, check: checkAt(base + '/tags'),
    upgrade() { assert.fail('The local CLI already includes the latest source'); }, log() {} });
  assert.equal(result.status, 'synced');
  assert.equal(result.installed, AGENTS.length);
  assert.equal(result.backups.length, AGENTS.length);
  assert.equal(requests.length, 1);
  for (const agent of plan) assert.equal(JSON.parse(await fs.readFile(path.join(agent.directory, 'design-to-handoff', 'version.json'))).version, version);
})));

test('update discovers only installed hosts, including legacy entries, and retains unrelated skills', async () => sandbox(async root => {
  const plan = buildPlan(AGENTS.map(a => a.id), { root, explicitRoot: true });
  await fs.mkdir(path.join(plan[2].directory, 'design-intake'), { recursive: true });
  await fs.writeFile(path.join(plan[2].directory, 'design-intake', 'notes.txt'), 'legacy data');
  await fs.mkdir(path.join(plan[2].directory, 'other'), { recursive: true });
  assert.deepEqual((await installedTargets(plan)).map(a => a.id), ['codebuddy']);
  const result = await updateInstallation({ source, plan, currentVersion: version, check: async () => version, log() {} });
  assert.equal(result.installed, 1);
  assert.equal(result.retired, 1);
  assert.deepEqual((await fs.readdir(plan[2].directory)).sort(), ['design-to-handoff', 'other']);
  for (const agent of plan.filter(a => a.id !== 'codebuddy')) await assert.rejects(fs.access(agent.directory));
}));

test('no installation fails before remote check, dry run avoids downloads and file writes', async () => sandbox(async root => {
  const plan = buildPlan(['codex'], { root, explicitRoot: true });
  await assert.rejects(updateInstallation({ source, plan, currentVersion: version, check() { assert.fail('Do not query when nothing is installed'); } }), /未找到已安装/);
  await install(source, plan);
  const before = await fs.readFile(path.join(plan[0].directory, 'design-to-handoff', 'version.json'), 'utf8');
  const result = await updateInstallation({ source, plan, currentVersion: version, dryRun: true, check: async () => '1.0.0',
    upgrade() { assert.fail('Dry run must not download'); }, log() {} });
  assert.equal(result.status, 'dry-run');
  assert.equal(await fs.readFile(path.join(plan[0].directory, 'design-to-handoff', 'version.json'), 'utf8'), before);
}));

test('new CLI version upgrades once; download failure leaves every installed skill intact', async () => sandbox(async root => {
  const plan = buildPlan(['codex', 'codebuddy'], { root, explicitRoot: true });
  await install(source, plan);
  let calls = 0;
  const options = { source, plan, currentVersion: version, check: async () => '1.0.0', log() {} };
  await assert.rejects(updateInstallation({ ...options, upgrade: async (next, targets) => {
    calls++; assert.equal(next, '1.0.0'); assert.deepEqual(targets, plan); throw new Error('download unavailable');
  } }), /download unavailable/);
  assert.equal(calls, 1);
  for (const agent of plan) {
    assert.equal(JSON.parse(await fs.readFile(path.join(agent.directory, 'design-to-handoff', 'version.json'))).version, version);
    await assert.rejects(fs.access(path.join(path.dirname(agent.directory), '.design-to-handoff-backups')));
  }
  const result = await updateInstallation({ ...options, upgrade: async () => { calls++; } });
  assert.equal(result.status, 'upgraded');
  assert.equal(calls, 2);
}));

test('metadata error, invalid local marker and cancellation keep existing skill intact', async () => sandbox(async root => {
  const plan = buildPlan(['codebuddy'], { root, explicitRoot: true });
  await install(source, plan);
  const marker = path.join(plan[0].directory, 'design-to-handoff', 'version.json');
  await server(async base => {
    await assert.rejects(updateInstallation({ source, plan, currentVersion: version, check: checkAt(base + '/limited') }), /HTTP 403/);
  });
  await fs.writeFile(marker, '{broken');
  await assert.rejects(updateInstallation({ source, plan, currentVersion: version, check: async () => version }), /无法读取安装版本/);
  assert.equal(await fs.readFile(marker, 'utf8'), '{broken');
  await fs.writeFile(marker, JSON.stringify({ version: '0.4.0' }));
  const controller = new AbortController(); controller.abort(new Error('cancel update'));
  await assert.rejects(updateInstallation({ source, plan, currentVersion: version, check: async () => version, signal: controller.signal, log() {} }), /cancel update/);
  assert.equal(JSON.parse(await fs.readFile(marker)).version, '0.4.0');
}));

test('newer installed skills are never downgraded by an older local CLI', async () => sandbox(async root => {
  const plan = buildPlan(['cursor'], { root, explicitRoot: true });
  await install(source, plan);
  await fs.writeFile(path.join(plan[0].directory, 'design-to-handoff', 'version.json'), '{"version":"9.0.0"}');
  const result = await updateInstallation({ source, plan, currentVersion: version, check: async () => version, log() {} });
  assert.equal(result.status, 'current');
  assert.equal(JSON.parse(await fs.readFile(path.join(plan[0].directory, 'design-to-handoff', 'version.json'))).version, '9.0.0');
}));

test('npm resolves a JS entry and subprocess arguments preserve spaces without a shell', async () => sandbox(async root => {
  const directory = path.join(root, 'path with spaces'); await fs.mkdir(directory);
  const npm = path.join(directory, 'npm-cli.js');
  await fs.writeFile(npm, 'console.log(JSON.stringify(process.argv.slice(2)));');
  const resolved = await resolveNpmCli({ env: { npm_execpath: npm, PATH: '' } });
  assert.equal(resolved, npm);
  assert.equal(await runNode(npm, ['prefix', '--global', 'custom path with spaces'], { capture: true }), '["prefix","--global","custom path with spaces"]');
  const child = path.join(directory, 'failure.mjs'); await fs.writeFile(child, 'process.exit(2);');
  await assert.rejects(runNode(child, [], { capture: true }), /命令执行失败/);
  assert.equal(globalPackageDirectory(root, 'win32'), path.join(root, 'node_modules', 'design-to-handoff'));
  assert.equal(globalPackageDirectory(root, 'darwin'), path.join(root, 'lib', 'node_modules', 'design-to-handoff'));
}));

test('CLI --version and offline installed-only synchronization work without prompts', async () => sandbox(async root => {
  assert.equal(spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }).stdout.trim(), version);
  const plan = buildPlan(['codebuddy'], { root, explicitRoot: true });
  await install(source, plan);
  await fs.rm(path.join(plan[0].directory, 'design-to-handoff', 'version.json'));
  const child = spawnSync(process.execPath, [cli, 'install', '--installed-only', '--root', root, '--agents', 'codebuddy', '--yes'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /更新完成/);
  assert.equal(JSON.parse(await fs.readFile(path.join(plan[0].directory, 'design-to-handoff', 'version.json'))).version, version);
}));

test('WorkBuddy-only updates reuse its installed native target without touching CodeBuddy', async () => sandbox(async root => {
  const both = buildPlan(['codebuddy', 'workbuddy'], { root, explicitRoot: true });
  await install(source, both);
  for (const agent of both) await fs.writeFile(path.join(agent.directory, 'design-to-handoff', 'version.json'), '{"version":"0.6.1"}');
  const selected = buildPlan(['workbuddy'], { root, explicitRoot: true });
  const result = await updateInstallation({ source, plan: selected, currentVersion: version, check: async () => version, log() {} });
  assert.equal(result.installed, 1);
  assert.deepEqual(result.agents, ['workbuddy']);
  assert.equal(JSON.parse(await fs.readFile(path.join(both[0].directory, 'design-to-handoff', 'version.json'))).version, '0.6.1');
  assert.equal(JSON.parse(await fs.readFile(path.join(both[1].directory, 'design-to-handoff', 'version.json'))).version, version);
}));

test('project update with both product names updates and backs up their shared target once', async () => sandbox(async root => {
  const plan = buildPlan(['workbuddy', 'codebuddy'], { root, scope: 'project', explicitRoot: true });
  await install(source, plan);
  await fs.writeFile(path.join(plan[0].directory, 'design-to-handoff', 'version.json'), '{"version":"0.6.1"}');
  const result = await updateInstallation({ source, plan, currentVersion: version, check: async () => version, log() {} });
  assert.equal(result.installed, 1);
  assert.equal(result.backups.length, 1);
  assert.deepEqual(result.agents, ['workbuddy', 'codebuddy']);
}));
