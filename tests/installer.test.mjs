import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { AGENTS, SKILLS, LEGACY_SKILLS, buildPlan, findConflicts, install, parseSelection } from '../lib/installer.mjs';

const source = fileURLToPath(new URL('../skills/', import.meta.url));
const cli = fileURLToPath(new URL('../bin/install.mjs', import.meta.url));
const terminalFixture = new URL('./fixtures/terminal-input.mjs', import.meta.url).href;
async function sandbox(fn) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'design-handoff-test-'));
  try { await fn(root); } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test('numeric and named multi-selection, duplicates, all and cancellation', () => {
  assert.deepEqual(parseSelection('1,2 3'), ['codex', 'claude-code', 'codebuddy']);
  assert.deepEqual(parseSelection('codex,claude-code,codebuddy'), ['codex', 'claude-code', 'codebuddy']);
  assert.deepEqual(parseSelection('1，1,4'), ['codex', 'cursor']);
  assert.deepEqual(parseSelection('a'), AGENTS.map(a => a.id));
  assert.deepEqual(parseSelection('q'), []);
  assert.deepEqual(parseSelection('5'), ['opencode']);
  assert.deepEqual(parseSelection('6'), ['workbuddy']);
  assert.deepEqual(parseSelection('WorkBuddy,codebuddy'), ['workbuddy', 'codebuddy']);
  for (const input of ['', '0', '7', 'unknown']) assert.throws(() => parseSelection(input));
});

test('Windows paths include spaces and Unicode without shell quoting', () => {
  const root = 'C:\\Users\\Design User ' + String.fromCodePoint(0x8bbe, 0x8ba1);
  const plan = buildPlan(['codex', 'claude-code', 'codebuddy'], { root, env: {}, pathApi: path.win32 });
  assert.deepEqual(plan.map(a => a.directory), ['.agents', '.claude', '.codebuddy'].map(p => path.win32.join(root, p, 'skills')));
  assert.equal(buildPlan(['codex'], { root, env: { CODEX_HOME: 'D:\\Custom Codex' }, pathApi: path.win32 })[0].directory, 'D:\\Custom Codex\\skills');
});

test('macOS paths and explicit root, with environment overrides', () => {
  const root = '/profiles/design user';
  assert.equal(buildPlan(['codex'], { root, env: {}, pathApi: path.posix })[0].directory, '/profiles/design user/.agents/skills');
  assert.equal(buildPlan(['claude-code'], { root, env: { CLAUDE_CONFIG_DIR: '/custom/claude' }, pathApi: path.posix })[0].directory, '/custom/claude/skills');
  assert.equal(buildPlan(['codex'], { root, explicitRoot: true, env: { CODEX_HOME: '/unrelated' }, pathApi: path.posix })[0].directory, '/profiles/design user/.agents/skills');
  assert.equal(buildPlan(['codebuddy'], { root, scope: 'project', env: {}, pathApi: path.posix })[0].directory, '/profiles/design user/.codebuddy/skills');
});

test('three selected agents receive one complete skill with internal modules; unselected remains absent', async () => sandbox(async parent => {
  const root = path.join(parent, 'design user \u8bbe\u8ba1');
  const plan = buildPlan(['codex', 'claude-code', 'codebuddy'], { root, explicitRoot: true });
  const result = await install(source, plan);
  assert.equal(result.installed, 3);
  assert.equal(result.retired, 0);
  for (const agent of plan) {
    const entry = path.join(agent.directory, 'design-to-handoff');
    assert.equal((await fs.readdir(agent.directory)).length, 1);
    assert.equal((await fs.readdir(path.join(entry, 'references', 'stages'))).length, 6);
    await fs.access(path.join(entry, 'scripts', 'verify_delivery.py'));
    for (const item of await fs.readdir(entry, { recursive: true })) {
      if (path.basename(item).toLowerCase() === 'skill.md') assert.equal(item, 'SKILL.md');
      if (!item.endsWith('.md')) continue;
      const file = path.join(entry, item);
      for (const [, target] of (await fs.readFile(file, 'utf8')).matchAll(/\]\(([^)]+)\)/g)) {
        if (!/^(https?:|#)/.test(target)) {
          const destination = path.resolve(path.dirname(file), target.split("#")[0]);
          assert.equal(path.relative(entry, destination).startsWith('..'), false);
          await fs.access(destination);
        }
      }
    }
    for (const name of SKILLS) {
      const actual = path.join(agent.directory, name, 'SKILL.md');
      assert.equal(await fs.readFile(actual, 'utf8'), await fs.readFile(path.join(source, name, 'SKILL.md'), 'utf8'));
    }
    for (const skill of SKILLS) {
      const file = path.join(agent.directory, skill, 'SKILL.md');
      for (const [, target] of (await fs.readFile(file, 'utf8')).matchAll(/\]\(([^)]+)\)/g)) {
        if (!/^(https?:|#)/.test(target)) await fs.access(path.resolve(path.dirname(file), target.split("#")[0]));
      }
    }
    assert.equal((await fs.lstat(path.join(agent.directory, SKILLS[0]))).isSymbolicLink(), false);
  }
  await assert.rejects(fs.access(path.join(root, '.cursor')));
}));

test('existing same-name skills need consent, are backed up, and unrelated skills survive', async () => sandbox(async root => {
  const plan = buildPlan(['codebuddy'], { root, explicitRoot: true });
  await fs.mkdir(path.join(plan[0].directory, 'design-intake'), { recursive: true });
  await fs.writeFile(path.join(plan[0].directory, 'design-intake', 'user-notes.txt'), 'user data');
  await fs.mkdir(path.join(plan[0].directory, 'unrelated'), { recursive: true });
  await fs.writeFile(path.join(plan[0].directory, 'unrelated', 'SKILL.md'), 'keep me');
  assert.equal((await findConflicts(plan)).length, 1);
  await assert.rejects(install(source, plan), /confirmation/);
  const result = await install(source, plan, { allowReplace: true });
  assert.equal(result.backups.length, 1);
  assert.equal(result.retired, 1);
  await assert.rejects(fs.access(path.join(plan[0].directory, 'design-intake')));
  assert.equal(await fs.readFile(path.join(result.backups[0], 'user-notes.txt'), 'utf8'), 'user data');
  assert.equal(await fs.readFile(path.join(plan[0].directory, 'unrelated', 'SKILL.md'), 'utf8'), 'keep me');
}));

test('upgrade retires all six legacy entries for every selected host and preserves each backup', async () => sandbox(async root => {
  const plan = buildPlan(AGENTS.map(a => a.id), { root, explicitRoot: true });
  for (const agent of plan) {
    for (const name of [...SKILLS, ...LEGACY_SKILLS, 'unrelated']) {
      await fs.mkdir(path.join(agent.directory, name), { recursive: true });
      await fs.writeFile(path.join(agent.directory, name, 'notes.txt'), `${agent.id}/${name}`);
    }
  }
  assert.equal((await findConflicts(plan)).length, AGENTS.length * (SKILLS.length + LEGACY_SKILLS.length));
  await assert.rejects(install(source, plan), /confirmation/);
  const result = await install(source, plan, { allowReplace: true });
  assert.equal(result.installed, AGENTS.length);
  assert.equal(result.retired, AGENTS.length * LEGACY_SKILLS.length);
  assert.equal(result.backups.length, AGENTS.length * (SKILLS.length + LEGACY_SKILLS.length));
  for (const agent of plan) {
    assert.deepEqual((await fs.readdir(agent.directory)).sort(), ['design-to-handoff', 'unrelated']);
    assert.equal(await fs.readFile(path.join(agent.directory, 'unrelated', 'notes.txt'), 'utf8'), `${agent.id}/unrelated`);
  }
  for (const backup of result.backups) {
    const agent = path.basename(path.dirname(backup));
    assert.equal(await fs.readFile(path.join(backup, 'notes.txt'), 'utf8'), `${agent}/${path.basename(backup)}`);
  }
}));

test('failure during legacy retirement restores the complete previous skill set', async () => sandbox(async root => {
  const plan = buildPlan(['codebuddy'], { root, explicitRoot: true });
  for (const name of [...SKILLS, ...LEGACY_SKILLS]) {
    await fs.mkdir(path.join(plan[0].directory, name), { recursive: true });
    await fs.writeFile(path.join(plan[0].directory, name, 'original.txt'), name);
  }
  let writes = 0;
  await assert.rejects(install(source, plan, { allowReplace: true, beforeMove() {
    if (++writes === 4) throw new Error('retirement failed');
  } }), /retirement failed/);
  assert.deepEqual((await fs.readdir(plan[0].directory)).sort(), [...SKILLS, ...LEGACY_SKILLS].sort());
  for (const name of [...SKILLS, ...LEGACY_SKILLS]) {
    assert.equal(await fs.readFile(path.join(plan[0].directory, name, 'original.txt'), 'utf8'), name);
  }
}));

test('partial write failure restores previous skills and removes incomplete new ones', async () => sandbox(async root => {
  const plan = buildPlan(['claude-code', 'codebuddy'], { root, explicitRoot: true });
  const old = path.join(plan[0].directory, SKILLS[0]);
  await fs.mkdir(old, { recursive: true });
  await fs.writeFile(path.join(old, 'user-file.txt'), 'original');
  let writes = 0;
  await assert.rejects(install(source, plan, { allowReplace: true, beforeMove() {
    if (++writes === 2) throw new Error('simulated disk/permission failure');
  } }), /simulated disk/);
  assert.equal(await fs.readFile(path.join(old, 'user-file.txt'), 'utf8'), 'original');
  assert.deepEqual(await fs.readdir(plan[0].directory), [SKILLS[0]]);
  assert.deepEqual(await fs.readdir(plan[1].directory), []);
}));

test('CLI dry run and noninteractive no-selection do not write any agent directory', async () => sandbox(async root => {
  const dry = spawnSync(process.execPath, [cli, '--agents', 'codex,claude-code,codebuddy', '--root', root, '--dry-run'], { encoding: 'utf8' });
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Dry run/);
  assert.deepEqual(await fs.readdir(root), []);
  const noSelection = spawnSync(process.execPath, [cli, '--root', root], { encoding: 'utf8' });
  assert.equal(noSelection.status, 1);
  assert.match(noSelection.stderr, /interactive terminal/);
  const noConsent = spawnSync(process.execPath, [cli, '--root', root, '--agents', 'codex'], { encoding: 'utf8' });
  assert.equal(noConsent.status, 1);
  assert.deepEqual(await fs.readdir(root), []);
}));

test('CLI installs selected agents in a sandbox with --yes and rejects invalid agents', async () => sandbox(async root => {
  const result = spawnSync(process.execPath, [cli, '--agents', '1,2,3', '--root', root, '--yes'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await fs.readdir(root)).sort(), ['.agents', '.claude', '.codebuddy']);
  for (const agent of buildPlan(['codex', 'claude-code', 'codebuddy'], { root, explicitRoot: true })) assert.equal((await fs.readdir(agent.directory)).length, 1);
  const invalid = spawnSync(process.execPath, [cli, '--agents', 'not-an-agent', '--root', root, '--yes'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
}));

test('missing source blocks installation before any destination change', async () => sandbox(async root => {
  const plan = buildPlan(['codex'], { root, explicitRoot: true });
  await assert.rejects(install(path.join(root, 'missing'), plan));
  assert.deepEqual(await fs.readdir(root), []);
}));

test('OpenCode uses native global/project paths and respects XDG configuration', () => {
  assert.equal(buildPlan(['opencode'], { root: '/profiles/test', env: {}, pathApi: path.posix })[0].directory, '/profiles/test/.config/opencode/skills');
  assert.equal(buildPlan(['opencode'], { root: '/profiles/test', scope: 'project', env: {}, pathApi: path.posix })[0].directory, '/profiles/test/.opencode/skills');
  assert.equal(buildPlan(['opencode'], { root: '/profiles/test', env: { XDG_CONFIG_HOME: '/custom/config' }, pathApi: path.posix })[0].directory, '/custom/config/opencode/skills');
  assert.equal(buildPlan(['opencode'], { root: 'C:\\Profiles\\Test', env: {}, pathApi: path.win32 })[0].directory, 'C:\\Profiles\\Test\\.config\\opencode\\skills');
});

test('all supported agents install the skill pack without optional OpenAI UI metadata', async () => sandbox(async root => {
  const portableSource = path.join(root, 'source');
  await fs.cp(source, portableSource, { recursive: true });
  for (const name of SKILLS) await fs.rm(path.join(portableSource, name, 'agents'), { recursive: true, force: true });
  const plan = buildPlan(AGENTS.map(a => a.id), { root: path.join(root, 'destination'), explicitRoot: true });
  const result = await install(portableSource, plan);
  assert.equal(result.installed, AGENTS.length);
  for (const agent of plan) for (const name of SKILLS) {
    await fs.access(path.join(agent.directory, name, 'SKILL.md'));
    await assert.rejects(fs.access(path.join(agent.directory, name, 'agents', 'openai.yaml')));
  }
}));

function interactive(t, root) {
  const child = spawn(process.execPath, ['--import', terminalFixture, cli, '--root', root], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let output = '';
  const collect = chunk => {
    output += chunk.toString('utf8');
    if (output.length > 100_000) child.kill('SIGKILL');
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  const finished = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Interactive installer did not exit promptly: ' + stripVTControlCharacters(output).slice(-2000)));
    }, 8000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal, output: stripVTControlCharacters(output) });
    });
  });
  // Attach early so failures while waiting for a prompt are not unhandled.
  finished.catch(() => {});
  return {
    child, finished,
    async waitFor(text) {
      const deadline = Date.now() + 5000;
      while (!stripVTControlCharacters(output).includes(text)) {
        if (Date.now() >= deadline || child.exitCode !== null) throw new Error(`Prompt not shown: ${text}\n${stripVTControlCharacters(output)}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    },
  };
}

test('arrow keys and Space select three agents; Enter proceeds and confirmation installs only them', async t => sandbox(async root => {
  const prompt = interactive(t, root);
  await prompt.waitFor('选择安装到哪些智能体');
  prompt.child.stdin.write(' \x1b[B \x1b[B \r');
  await prompt.waitFor('开始安装？');
  prompt.child.stdin.write('y\r');
  const result = await prompt.finished;
  assert.equal(result.code, 0, result.output);
  for (const agent of buildPlan(['codex', 'claude-code', 'codebuddy'], { root, explicitRoot: true })) assert.equal((await fs.readdir(agent.directory)).length, 1);
  await assert.rejects(fs.access(path.join(root, '.cursor')));
  await assert.rejects(fs.access(path.join(root, '.config', 'opencode')));
}));

test('one Ctrl+C in the selection menu exits once with no readline errors or writes', async t => sandbox(async root => {
  const prompt = interactive(t, root);
  await prompt.waitFor('选择安装到哪些智能体');
  prompt.child.stdin.write('\x03');
  const result = await prompt.finished;
  assert.equal(result.code, 130, result.output);
  assert.doesNotMatch(result.output, /readline was closed|ERR_USE_AFTER_CLOSE|Installation failed/);
  assert.equal((result.output.match(/已取消安装/g) || []).length, 1);
  assert.deepEqual(await fs.readdir(root), []);
}));

test('one Ctrl+C at installation confirmation exits without writes', async t => sandbox(async root => {
  const prompt = interactive(t, root);
  await prompt.waitFor('选择安装到哪些智能体');
  prompt.child.stdin.write(' \r');
  await prompt.waitFor('开始安装？');
  prompt.child.stdin.write('\x03');
  const result = await prompt.finished;
  assert.equal(result.code, 130, result.output);
  assert.doesNotMatch(result.output, /readline was closed|ERR_USE_AFTER_CLOSE|Installation failed/);
  assert.deepEqual(await fs.readdir(root), []);
}));

test('closed input while selecting cancels rather than retrying a closed readline', async t => sandbox(async root => {
  const prompt = interactive(t, root);
  await prompt.waitFor('选择安装到哪些智能体');
  prompt.child.stdin.end();
  const result = await prompt.finished;
  assert.equal(result.code, 130, result.output);
  assert.doesNotMatch(result.output, /readline was closed|ERR_USE_AFTER_CLOSE/);
  assert.deepEqual(await fs.readdir(root), []);
}));

test('cancellation during writes rolls back the earlier agents and original skills', async () => sandbox(async root => {
  const plan = buildPlan(['claude-code', 'codebuddy'], { root, explicitRoot: true });
  const original = path.join(plan[0].directory, SKILLS[0]);
  await fs.mkdir(original, { recursive: true });
  await fs.writeFile(path.join(original, 'original.txt'), 'keep original');
  const controller = new AbortController();
  let writes = 0;
  await assert.rejects(install(source, plan, {
    allowReplace: true, signal: controller.signal,
    beforeMove() { if (++writes === 2) controller.abort(new Error('cancel requested')); },
  }), /cancel requested/);
  assert.equal(await fs.readFile(path.join(original, 'original.txt'), 'utf8'), 'keep original');
  assert.deepEqual(await fs.readdir(plan[0].directory), [SKILLS[0]]);
  assert.deepEqual(await fs.readdir(plan[1].directory), []);
}));

console.log(`Installer tests running on ${process.platform}/${process.arch}`);

test('WorkBuddy uses its native global directory and compatible CodeBuddy project directory', () => {
  assert.equal(buildPlan(['workbuddy'], { root: '/profiles/Design User', env: {}, pathApi: path.posix })[0].directory, '/profiles/Design User/.workbuddy/skills');
  assert.equal(buildPlan(['workbuddy'], { root: '/projects/design', scope: 'project', env: {}, pathApi: path.posix })[0].directory, '/projects/design/.codebuddy/skills');
  assert.equal(buildPlan(['workbuddy'], { root: 'C:\\Users\\Design User', env: {}, pathApi: path.win32 })[0].directory, 'C:\\Users\\Design User\\.workbuddy\\skills');
  assert.equal(buildPlan(['workbuddy'], { root: 'D:\\Project Space', scope: 'project', env: {}, pathApi: path.win32 })[0].directory, 'D:\\Project Space\\.codebuddy\\skills');
});

test('selecting CodeBuddy and WorkBuddy shares one project destination and preserves both selections', async () => sandbox(async root => {
  const plan = buildPlan(['codebuddy', 'workbuddy'], { root, scope: 'project', explicitRoot: true });
  assert.equal(plan.length, 1);
  assert.deepEqual(plan[0].agentIds, ['codebuddy', 'workbuddy']);
  const old = path.join(plan[0].directory, 'design-to-handoff');
  await fs.mkdir(old, { recursive: true }); await fs.writeFile(path.join(old, 'notes.txt'), 'original');
  let writes = 0;
  const result = await install(source, plan, { allowReplace: true, beforeMove() { writes++; } });
  assert.equal(writes, 1);
  assert.equal(result.installed, 1);
  assert.equal(result.backups.length, 1);
  assert.deepEqual(result.agents, ['codebuddy', 'workbuddy']);
  assert.equal(await fs.readFile(path.join(result.backups[0], 'notes.txt'), 'utf8'), 'original');
  assert.deepEqual(await fs.readdir(plan[0].directory), ['design-to-handoff']);
  await assert.rejects(fs.access(path.join(root, '.workbuddy')));
}));

test('WorkBuddy-only CLI installation writes one native skill and leaves CodeBuddy untouched', async () => sandbox(async root => {
  const result = spawnSync(process.execPath, [cli, '--agents', 'workbuddy', '--root', root, '--yes'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const native = path.join(root, '.workbuddy', 'skills');
  assert.deepEqual(await fs.readdir(native), ['design-to-handoff']);
  await fs.access(path.join(native, 'design-to-handoff', 'references', 'workbuddy-input.md'));
  await assert.rejects(fs.access(path.join(root, '.codebuddy')));
}));

test('shared project replacement failure restores its only original copy', async () => sandbox(async root => {
  const plan = buildPlan(['workbuddy', 'codebuddy'], { root, scope: 'project', explicitRoot: true });
  assert.equal(plan.length, 1);
  const old = path.join(plan[0].directory, 'design-to-handoff');
  await fs.mkdir(old, { recursive: true }); await fs.writeFile(path.join(old, 'notes.txt'), 'original');
  await assert.rejects(install(source, plan, { allowReplace: true, beforeMove() { throw new Error('shared target failure'); } }), /shared target failure/);
  assert.deepEqual(await fs.readdir(old), ['notes.txt']);
  assert.equal(await fs.readFile(path.join(old, 'notes.txt'), 'utf8'), 'original');
}));
