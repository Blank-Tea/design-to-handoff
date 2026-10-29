#!/usr/bin/env node
import { confirm, isCancel, multiselect } from '@clack/prompts';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS, SKILLS, buildPlan, findConflicts, install, parseSelection } from '../lib/installer.mjs';

class InstallationCancelled extends Error {
  constructor() { super('Installation cancelled'); this.name = 'InstallationCancelled'; }
}

function answerOrCancel(value) {
  if (isCancel(value)) throw new InstallationCancelled();
  return value;
}

function isCancellation(error) {
  for (let current = error; current; current = current.cause) {
    if (current instanceof InstallationCancelled) return true;
  }
  return false;
}

function parseArgs(args) {
  const options = { scope: 'global', yes: false, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--agents' || arg === '--scope' || arg === '--root') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value: ${arg}`);
      options[arg.slice(2)] = args[++i];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Design to Handoff installer\n\nDefault: interactive multi-select, global installation.\n\n--agents codex,claude-code,codebuddy,cursor,opencode\n--scope global|project\n--root <absolute custom user/project root>\n--dry-run  Print plan without writing\n--yes      Confirm installation, backing up existing same-name skills\n\nNode.js >=22.20.0. No Python, native binaries, symlinks, or administrator rights required for installation.');
    return;
  }
  if (!['global', 'project'].includes(options.scope)) throw new Error('scope must be global or project');
  const terminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const controller = new AbortController();
  const requestCancel = () => controller.abort(new InstallationCancelled());
  const originalRawMode = Boolean(process.stdin.isRaw);
  process.once('SIGINT', requestCancel);
  if (terminal) {
    process.stdin.once('end', requestCancel);
    process.stdin.once('close', requestCancel);
  }
  try {
    let selected;
    if (options.agents) selected = parseSelection(options.agents);
    else {
      if (!terminal) throw new Error('Please run in an interactive terminal, or specify --agents and --yes (or --dry-run). Nothing installed.');
      console.log('\nDesign to Handoff');
      selected = answerOrCancel(await multiselect({
        message: '选择安装到哪些智能体（↑/↓ 移动，空格勾选，回车确认，Ctrl+C 取消）',
        options: AGENTS.map(a => ({ value: a.id, label: a.label })),
        initialValues: [],
        required: true,
        signal: controller.signal,
      }));
    }
    controller.signal.throwIfAborted();
    if (!selected.length) { console.log('Cancelled; nothing installed.'); return; }
    const root = options.root ? path.resolve(options.root) : options.scope === 'global' ? homedir() : process.cwd();
    const plan = buildPlan(selected, { root, scope: options.scope, explicitRoot: Boolean(options.root) });
    console.log(`\n将为 ${plan.length} 个智能体安装全部 ${SKILLS.length} 个技能：`);
    plan.forEach(a => console.log(`  ${a.label}: ${a.directory}`));
    const conflicts = await findConflicts(plan);
    controller.signal.throwIfAborted();
    if (conflicts.length) console.log(`\n发现 ${conflicts.length} 个同名技能，将备份后替换；其他技能不会改变。`);
    if (options.dryRun) { console.log('\nDry run; no files written.'); return; }
    if (!options.yes) {
      if (!terminal) throw new Error('Confirmation required: use --yes, or --dry-run to inspect. Nothing installed.');
      const accepted = answerOrCancel(await confirm({
        message: '开始安装？（Ctrl+C 取消）',
        active: '安装',
        inactive: '取消',
        initialValue: false,
        signal: controller.signal,
      }));
      if (!accepted) { console.log('已取消安装。'); return; }
    }
    controller.signal.throwIfAborted();
    const source = fileURLToPath(new URL('../skills/', import.meta.url));
    const result = await install(source, plan, { allowReplace: true, signal: controller.signal });
    console.log(`\n安装完成：${result.agents.length} 个智能体，${result.installed} 个技能目录。`);
    if (result.backups.length) console.log('备份目录：\n' + [...new Set(result.backups.map(p => path.dirname(p)))].join('\n'));
    console.log('请刷新或重启智能体。Codex 使用 $design-to-handoff；Claude Code 使用 /design-to-handoff；其他宿主可直接说“使用 design-to-handoff”。\nFigma/Penpot MCP 由各使用者自行连接，本安装器不写入账号和授权配置。');
  } finally {
    process.removeListener('SIGINT', requestCancel);
    if (terminal) {
      process.stdin.removeListener('end', requestCancel);
      process.stdin.removeListener('close', requestCancel);
      process.stdin.setRawMode?.(originalRawMode);
      process.stdin.pause();
      process.stdin.unref?.();
    }
  }
}

main().catch(error => {
  if (isCancellation(error) && !error.recoveryErrors?.length) {
    console.log('\n已取消安装。');
    process.exitCode = 130;
  } else {
    console.error(`\nInstallation failed: ${error.message}`);
    process.exitCode = 1;
  }
});
