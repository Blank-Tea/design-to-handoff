#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS, SKILLS, buildPlan, findConflicts, install, parseSelection } from '../lib/installer.mjs';

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
    console.log('Design to Handoff installer\n\nDefault: interactive multi-select, global installation.\n\n--agents codex,claude-code,codebuddy,cursor\n--scope global|project\n--root <absolute custom user/project root>\n--dry-run  Print plan without writing\n--yes      Confirm installation, backing up existing same-name skills\n\nNode.js >=22.20.0. No Python, native binaries, symlinks, or administrator rights required for installation.');
    return;
  }
  if (!['global', 'project'].includes(options.scope)) throw new Error('scope must be global or project');
  const terminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  let rl;
  try {
    let selected;
    if (options.agents) selected = parseSelection(options.agents);
    else {
      if (!terminal) throw new Error('Please run in an interactive terminal, or specify --agents and --yes (or --dry-run). Nothing installed.');
      rl = createInterface({ input: process.stdin, output: process.stdout });
      console.log('\nDesign to Handoff — 选择安装到哪些智能体（可多选）\n');
      AGENTS.forEach((a, i) => console.log(`  ${i + 1}. ${a.label}`));
      console.log('\n输入编号或名称，逗号/空格分隔，例如 1,2,3；a 全选；q 退出。');
      while (selected === undefined) {
        try { selected = parseSelection(await rl.question('请选择：')); }
        catch (error) { console.log(error.message); }
      }
    }
    if (!selected.length) { console.log('Cancelled; nothing installed.'); return; }
    const root = options.root ? path.resolve(options.root) : options.scope === 'global' ? homedir() : process.cwd();
    const plan = buildPlan(selected, { root, scope: options.scope, explicitRoot: Boolean(options.root) });
    console.log(`\n将为 ${plan.length} 个智能体安装全部 ${SKILLS.length} 个技能：`);
    plan.forEach(a => console.log(`  ${a.label}: ${a.directory}`));
    const conflicts = await findConflicts(plan);
    if (conflicts.length) console.log(`\n发现 ${conflicts.length} 个同名技能，将备份后替换；其他技能不会改变。`);
    if (options.dryRun) { console.log('\nDry run; no files written.'); return; }
    if (!options.yes) {
      if (!terminal) throw new Error('Confirmation required: use --yes, or --dry-run to inspect. Nothing installed.');
      rl ??= createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question('开始安装？[y/N] ')).trim().toLowerCase();
      if (!['y', 'yes'].includes(answer)) { console.log('Cancelled; nothing installed.'); return; }
    }
    const source = fileURLToPath(new URL('../skills/', import.meta.url));
    const result = await install(source, plan, { allowReplace: true });
    console.log(`\n安装完成：${result.agents.length} 个智能体，${result.installed} 个技能目录。`);
    if (result.backups.length) console.log('备份目录：\n' + [...new Set(result.backups.map(p => path.dirname(p)))].join('\n'));
    console.log('请刷新或重启智能体。Codex 使用 $design-to-handoff；Claude Code 使用 /design-to-handoff；其他宿主可直接说“使用 design-to-handoff”。\nFigma/Penpot MCP 由各使用者自行连接，本安装器不写入账号和授权配置。');
  } finally { rl?.close(); }
}

main().catch(error => { console.error(`\nInstallation failed: ${error.message}`); process.exitCode = 1; });
