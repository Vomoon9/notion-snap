#!/usr/bin/env node
/**
 * index.ts — NotionSnap CLI 入口
 * notion-snap <command> [options]
 *
 * Commands:
 *   init     — OAuth 授权
 *   backup   — 备份 Notion 工作空间
 *   status   — 查看凭证状态
 *   restore  — 从备份恢复到 Notion
 */

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { backupCommand } from './commands/backup';
import { statusCommand } from './commands/status';
import { restoreCommand } from './commands/restore';

const program = new Command();

program
  .name('notion-snap')
  .description('🫧 Open-source Notion workspace backup & restore tool')
  .version('0.1.0');

program
  .command('init')
  .description('OAuth 授权 — 连接你的 Notion 工作空间')
  .option('--client-id <id>', 'Notion OAuth Client ID (或环境变量 NOTION_OAUTH_CLIENT_ID)')
  .option('--client-secret <secret>', 'Notion OAuth Client Secret (或环境变量 NOTION_OAUTH_CLIENT_SECRET)')
  .action(async (opts) => {
    const clientId = opts.clientId || process.env.NOTION_OAUTH_CLIENT_ID;
    const clientSecret = opts.clientSecret || process.env.NOTION_OAUTH_CLIENT_SECRET;
    await initCommand(clientId, clientSecret);
  });

program
  .command('backup')
  .description('备份 Notion 工作空间')
  .option('-r, --root <pageId>', '根页面 ID')
  .option('-o, --output <dir>', '本地输出目录 (默认 ./backups)')
  .option('-c, --config <path>', '配置文件路径 (.yaml/.json)')
  .option('-g, --git <repo>', 'Git 仓库地址 (如 git@github.com:user/repo.git)')
  .option('-b, --branch <branch>', 'Git 分支 (默认 main)')
  .action(async (opts) => {
    await backupCommand(opts);
  });

program
  .command('status')
  .description('查看当前凭证状态')
  .action(async () => {
    await statusCommand();
  });

program
  .command('restore')
  .description('从备份恢复到 Notion')
  .option('-d, --dir <path>', '备份目录路径 (包含 manifest.json)')
  .option('--dest <pageId>', '目标父页面 ID (恢复内容的父页面)')
  .option('--dry-run', '预览模式，不实际创建内容')
  .option('--only <ids>', '只恢复指定 ID (逗号分隔)')
  .action(async (opts) => {
    await restoreCommand(opts);
  });

program.parse(process.argv);