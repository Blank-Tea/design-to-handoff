import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const SKILLS = Object.freeze(['design-to-handoff']);
export const LEGACY_SKILLS = Object.freeze([
  'design-intake', 'design-direction',
  'design-reference-analysis', 'design-compose',
  'design-publish-figma', 'design-publish-penpot',
]);
export const AGENTS = Object.freeze([
  { id: 'codex', label: 'Codex', directory: '.agents' },
  { id: 'claude-code', label: 'Claude Code', directory: '.claude' },
  { id: 'codebuddy', label: 'CodeBuddy', directory: '.codebuddy' },
  { id: 'cursor', label: 'Cursor', directory: '.cursor' },
  { id: 'opencode', label: 'OpenCode', directory: '.opencode' },
]);

export function parseSelection(value) {
  const input = value.trim().toLowerCase();
  if (['q', 'quit', 'cancel'].includes(input)) return [];
  if (['a', 'all'].includes(input)) return AGENTS.map(a => a.id);
  const values = input.split(/[,，\s]+/).filter(Boolean).map(token => {
    const agent = /^\d+$/.test(token) ? AGENTS[Number(token) - 1] : AGENTS.find(a => a.id === token);
    if (!agent) throw new Error(`Unknown agent selection: ${token}`);
    return agent.id;
  });
  if (!values.length) throw new Error('Select at least one agent, or q to cancel.');
  return [...new Set(values)];
}

export function buildPlan(ids, { root, scope = 'global', env = process.env, pathApi = path, explicitRoot = false } = {}) {
  if (!root) throw new Error('An installation root is required.');
  if (!['global', 'project'].includes(scope)) throw new Error('scope must be global or project');
  return [...new Set(ids)].map(id => {
    const agent = AGENTS.find(a => a.id === id);
    if (!agent) throw new Error(`Unknown agent: ${id}`);
    let directory = pathApi.join(root, agent.directory, 'skills');
    if (id === 'opencode' && scope === 'global') directory = pathApi.join(root, '.config', 'opencode', 'skills');
    if (scope === 'global' && !explicitRoot) {
      if (id === 'codex' && env.CODEX_HOME?.trim()) directory = pathApi.join(env.CODEX_HOME.trim(), 'skills');
      if (id === 'claude-code' && env.CLAUDE_CONFIG_DIR?.trim()) directory = pathApi.join(env.CLAUDE_CONFIG_DIR.trim(), 'skills');
      if (id === 'opencode' && env.XDG_CONFIG_HOME?.trim()) directory = pathApi.join(env.XDG_CONFIG_HOME.trim(), 'opencode', 'skills');
    }
    if (!pathApi.isAbsolute(directory)) throw new Error(`Installation path must be absolute: ${directory}`);
    return { id, label: agent.label, directory };
  });
}

async function exists(file) {
  try { await fs.lstat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function rejectSourceLinks(directory) {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error(`Skill source must not contain symlinks: ${item.name}`);
    if (item.isDirectory()) await rejectSourceLinks(path.join(directory, item.name));
  }
}

export async function validateSource(source) {
  for (const name of SKILLS) {
    const directory = path.join(source, name);
    if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error(`Skill source is a symlink: ${name}`);
    const text = await fs.readFile(path.join(directory, 'SKILL.md'), 'utf8');
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
    const declared = front && /^name:\s*(.+?)\s*$/m.exec(front)?.[1];
    if (declared !== name || !/^description:\s*\S/m.test(front || '')) throw new Error(`Invalid skill metadata: ${name}`);
    await rejectSourceLinks(directory);
  }
}

export async function findConflicts(plan) {
  const conflicts = [];
  for (const agent of plan) for (const name of [...SKILLS, ...LEGACY_SKILLS]) {
    const destination = path.join(agent.directory, name);
    if (await exists(destination)) conflicts.push(destination);
  }
  return conflicts;
}

export async function install(source, plan, { allowReplace = false, beforeMove, signal } = {}) {
  signal?.throwIfAborted();
  await validateSource(source);
  signal?.throwIfAborted();
  if (!plan.length) throw new Error('No agents selected.');
  const conflicts = await findConflicts(plan);
  if (conflicts.length && !allowReplace) throw new Error('Existing skills found; replacement requires confirmation.');
  const runId = `${Date.now()}-${randomUUID()}`;
  const stages = [], moves = [], backups = [];
  try {
    // Prepare every copy before changing any existing skill.
    for (const agent of plan) {
      signal?.throwIfAborted();
      const parent = path.dirname(agent.directory);
      await fs.mkdir(parent, { recursive: true });
      const staging = await fs.mkdtemp(path.join(parent, '.design-to-handoff-stage-'));
      stages.push(staging);
      for (const name of SKILLS) {
        signal?.throwIfAborted();
        await fs.cp(path.join(source, name), path.join(staging, name), { recursive: true, dereference: false, errorOnExist: true, force: false });
      }
      await fs.mkdir(agent.directory, { recursive: true });
    }
    for (let i = 0; i < plan.length; i++) {
      const agent = plan[i];
      for (const name of [...SKILLS, ...LEGACY_SKILLS]) {
        signal?.throwIfAborted();
        const destination = path.join(agent.directory, name);
        const active = SKILLS.includes(name);
        if (!active && !await exists(destination)) continue;
        const backup = path.join(path.dirname(agent.directory), '.design-to-handoff-backups', runId, agent.id, name);
        const move = { destination, backup, installed: false, backedUp: false };
        moves.push(move);
        if (await exists(destination)) {
          await fs.mkdir(path.dirname(backup), { recursive: true });
          await fs.rename(destination, backup);
          move.backedUp = true;
          backups.push(backup);
        }
        if (beforeMove) await beforeMove({ agent: agent.id, name, destination });
        signal?.throwIfAborted();
        if (active) {
          await fs.rename(path.join(stages[i], name), destination);
          move.installed = true;
        }
      }
    }
    signal?.throwIfAborted();
    return {
      installed: moves.filter(move => move.installed).length,
      retired: moves.filter(move => move.backedUp && !move.installed).length,
      agents: plan.map(a => a.id), backups,
    };
  } catch (cause) {
    const recoveryErrors = [];
    for (const move of moves.reverse()) {
      try {
        if (move.installed) await fs.rm(move.destination, { recursive: true, force: true });
        if (move.backedUp) await fs.rename(move.backup, move.destination);
      } catch (error) { recoveryErrors.push(`${move.destination}: ${error.message}; backup: ${move.backup}`); }
    }
    const error = new Error(`${cause.message}${recoveryErrors.length ? '\nRecovery needs attention:\n' + recoveryErrors.join('\n') : '\nExisting skills restored; no partial skill set retained.'}`, { cause });
    error.recoveryErrors = recoveryErrors;
    throw error;
  } finally {
    for (const stage of stages) await fs.rm(stage, { recursive: true, force: true }).catch(() => {});
  }
}
