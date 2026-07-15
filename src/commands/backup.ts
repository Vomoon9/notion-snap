/**
 * commands/backup.ts — notion-snap backup
 * 备份命令：读取 Notion → 导出 → 写入存储
 */

import { NotionClient } from '../notion/client';
import { runBackup } from '../orchestrator/backup-runner';
import { LocalStorage } from '../storage/local';
import { GitStorage } from '../storage/git';
import { loadConfig, loadEnv, BackupConfig } from '../utils/config';
import { logger } from '../utils/logger';

export async function backupCommand(options: {
  root?: string;
  output?: string;
  config?: string;
  git?: string;
  branch?: string;
}): Promise<void> {
  console.log('═══════════════════════════════════════');
  console.log('  🫧 NotionSnap — 备份');
  console.log('═══════════════════════════════════════\n');

  // 加载配置
  let config: BackupConfig;
  if (options.config) {
    config = loadConfig(options.config);
  } else {
    // 从命令行参数构建
    if (!options.root) {
      console.error('❌ 需要指定根页面 ID: --root <pageId>');
      console.error('   或使用配置文件: --config <path>');
      process.exit(1);
    }

    const storageType = options.git ? 'git' : 'local';
    config = {
      source: { rootPageId: options.root },
      storage: {
        type: storageType,
        outputDir: options.output || './backups',
        repo: options.git,
        branch: options.branch || 'main',
      },
      export: { timezone: 'UTC' },
    };
  }

  loadEnv();

  // 创建 Notion 客户端
  let client: NotionClient;
  try {
    client = new NotionClient();
  } catch (e: any) {
    logger.error(e.message);
    process.exit(1);
  }

  logger.info(`已连接工作空间: ${client.workspaceName}`);

  // 创建存储后端
  let storage: LocalStorage | GitStorage;
  if (config.storage.type === 'git') {
    if (!config.storage.repo) {
      console.error('❌ Git 存储需要 repo 地址');
      process.exit(1);
    }
    const gitStorage = new GitStorage(config.storage.repo, config.storage.branch);
    logger.info(`克隆 Git 仓库: ${config.storage.repo}...`);
    await gitStorage.init();
    storage = gitStorage;
  } else {
    const outputDir = config.storage.outputDir || './backups';
    storage = new LocalStorage(outputDir);
    logger.info(`输出目录: ${outputDir}`);
  }

  // 运行备份
  try {
    const manifest = await runBackup(client, config.source.rootPageId, storage);

    // 完成存储（git commit/push 或 local noop）
    const successCount = manifest.stats.success;
    const failedCount = manifest.stats.failed;
    const commitMsg = `backup: ${manifest.timestamp.slice(0, 16)} — ${successCount} pages${failedCount > 0 ? `, ${failedCount} failed` : ''}`;
    await storage.finalize(commitMsg);

    // Git 清理
    if (config.storage.type === 'git') {
      await (storage as GitStorage).cleanup();
    }

    console.log('\n🎉 备份完成！');
    process.exit(manifest.stats.failed > 0 ? 1 : 0);
  } catch (e: any) {
    logger.error(`备份失败: ${e.message}`);
    process.exit(1);
  }
}