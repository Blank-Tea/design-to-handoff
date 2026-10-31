#!/usr/bin/env node
import { confirm, isCancel, multiselect } from '@clack/prompts';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { AGENTS, SKILLS, buildPlan, findConflicts, install, parseSelection } from '../lib/installer.mjs';
import { globalPackageDirectory, resolveNpmCli, runNode, updateInstallation } from '../lib/updater.mjs';

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
  const options = { command: 'install', scope: 'global', yes: false, dryRun: false };
  if (['install', 'update'].includes(args[0])) {
    options.command = args[0];
    args = args.slice(1);
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version' || arg === '-v') options.version = true;
    else if (arg === '--installed-only') options.installedOnly = true;
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
  const packageFile = fileURLToPath(new URL('../package.json', import.meta.url));
  const packageVersion = JSON.parse(await readFile(packageFile, 'utf8')).version;
  if (options.version) { console.log(packageVersion); return; }
  if (options.help) {
    console.log('Design to Handoff\n\ndesign-to-handoff          Interactive multi-select installation\ndesign-to-handoff update   Check stable releases and update installed agents\ndesign-to-handoff --version\n\n--agents codex,claude-code,codebuddy,cursor,opencode,workbuddy\n--scope global|project\n--root <absolute custom user/project root>\n--dry-run  Check and print plan without writing\n--yes      Confirm installation, backing up existing same-name skills\n\nUpdate reuses installed targets without asking again. Downloads only when a newer CLI is released.\nNode.js >=22.20.0 with npm. No Git or Python required.');
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
    const root = options.root ? path.resolve(options.root) : options.scope === 'global' ? homedir() : process.cwd();
    const source = fileURLToPath(new URL('../skills/', import.meta.url));
    const planOptions = { root, scope: options.scope, explicitRoot: Boolean(options.root) };
    if (options.command === 'update' || options.installedOnly) {
      const ids = options.agents ? parseSelection(options.agents) : AGENTS.map(a => a.id);
      const configured = buildPlan(ids, planOptions);
      const defaults = options.scope === 'global' && !options.root ? buildPlan(ids, { ...planOptions, env: {} }) : [];
      const plan = [...new Map([...configured, ...defaults].map(a => [a.directory, a])).values()];
      await updateInstallation({ source, plan, currentVersion: packageVersion, dryRun: options.dryRun,
        signal: controller.signal,
        ...(options.installedOnly ? { check: async () => packageVersion } : {}),
        upgrade: async (version, targets) => {
          const npm = await resolveNpmCli();
          const prefix = await runNode(npm, ['prefix', '--global'], { capture: true, signal: controller.signal });
          if (!path.isAbsolute(prefix)) throw new Error('npm global prefix is not absolute.');
          const archive = `https://codeload.github.com/Blank-Tea/design-to-handoff/tar.gz/refs/tags/v${version}`;
          console.log(`正在升级命令行到 ${version}…`);
          await runNode(npm, ['install', '--global', '--ignore-scripts', archive], { signal: controller.signal });
          const directory = globalPackageDirectory(prefix);
          const actual = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
          if (actual.name !== 'design-to-handoff' || actual.version !== version) throw new Error('下载版本不匹配，尚未更改技能目录。');
          const args = ['install', '--installed-only', '--yes', '--agents', [...new Set(targets.flatMap(a => a.agentIds || [a.id]))].join(','), '--scope', options.scope];
          if (options.root) args.push('--root', root);
          await runNode(path.join(directory, 'bin', 'install.mjs'), args, { signal: controller.signal });
        },
      });
      return;
    }
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
    const plan = buildPlan(selected, planOptions);
    const selectedCount = plan.flatMap(a => a.agentIds || [a.id]).length;
    console.log(`\n将为 ${selectedCount} 个智能体安装 design-to-handoff 单入口（${SKILLS.length} 个技能，${plan.length} 个安装位置）：`);
    plan.forEach(a => console.log(`  ${a.label}: ${a.directory}`));
    const conflicts = await findConflicts(plan);
    controller.signal.throwIfAborted();
    if (conflicts.length) console.log(`\n发现 ${conflicts.length} 个本包现有入口，将先备份；主入口更新，旧六个子入口如存在则移出技能目录。其他技能不会改变。`);
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
    const result = await install(source, plan, { allowReplace: true, signal: controller.signal });
    console.log(`\n安装完成：${result.agents.length} 个智能体，${result.installed} 个技能目录。`);
    if (result.retired) console.log(`已将 ${result.retired} 个旧子入口移出技能目录并保存备份。`);
    if (result.backups.length) console.log('备份目录：\n' + [...new Set(result.backups.map(p => path.dirname(p)))].join('\n'));
    console.log('请刷新或重启智能体。Codex 使用 $design-to-handoff；Claude Code 使用 /design-to-handoff；其他宿主可直接说“使用 design-to-handoff”。\nFigma/Ardot MCP 由各使用者自行连接，本安装器不写入账号和授权配置。');
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
