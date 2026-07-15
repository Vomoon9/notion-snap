/**
 * commands/restore.ts — notion-snap restore
 * 从备份恢复到 Notion
 */

import { NotionClient } from '../notion/client';
import { runRestore } from '../orchestrator/restore-runner';
import { logger } from '../utils/logger';

export async function restoreCommand(options: {
  dir: string;
  dest: string;
  dryRun?: boolean;
  only?: string;
}): Promise<void> {
  console.log('═══════════════════════════════════════');
  console.log('  🫧 NotionSnap — 恢复');
  console.log('═══════════════════════════════════════\n');

  if (!options.dir) {
    console.error('❌ 需要指定备份目录: --dir <path>');
    process.exit(1);
  }
  if (!options.dest) {
    console.error('❌ 需要指定目标页面 ID: --dest <pageId>');
    console.error('   目标页面是恢复内容的父页面，需要已共享给 NotionSnap integration');
    process.exit(1);
  }

  // 创建 Notion 客户端
  let client: NotionClient;
  try {
    client = new NotionClient();
  } catch (e: any) {
    logger.error(e.message);
    process.exit(1);
  }

  logger.info(`已连接工作空间: ${client.workspaceName}`);
  logger.info(`备份目录: ${options.dir}`);
  logger.info(`目标页面: ${options.dest}`);
  if (options.dryRun) logger.info('🔍 DRY RUN 模式\n');

  const onlyIds = options.only ? options.only.split(',').map(s => s.trim()) : undefined;

  try {
    const result = await runRestore(client, options.dir, options.dest, {
      dryRun: options.dryRun || false,
      onlyIds,
    });

    if (result.failed > 0) {
      console.log('\n⚠️  部分恢复失败:');
      for (const err of result.errors) {
        console.log(`  ❌ ${err}`);
      }
    }

    console.log('\n🎉 恢复完成！');
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (e: any) {
    logger.error(`恢复失败: ${e.message}`);
    process.exit(1);
  }
}