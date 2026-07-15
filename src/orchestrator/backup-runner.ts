/**
 * orchestrator/backup-runner.ts — 备份流程编排
 * 核心逻辑：遍历页面树 → 导出每个页面/数据库 → 写入存储 → 生成 manifest
 *
 * 错误处理策略：
 * - 单页失败不中断整次备份
 * - 记录到 manifest.failed，继续下一个
 * - 连续 5 个 401 → token 过期，中止
 */

import { NotionClient } from '../notion/client';
import { discoverTree, flattenTree } from '../notion/reader';
import { blocksToMarkdown } from '../exporter/markdown';
import { pageToJson, computeHash } from '../exporter/json-snapshot';
import { exportDatabase } from '../exporter/database';
import { createManifest, addSuccess, addFailure, finalizeManifest, printSummary } from '../exporter/manifest';
import { pagePath } from '../utils/slug';
import { logger } from '../utils/logger';
import { Manifest } from '../notion/types';

let consecutive401 = 0;
const MAX_401 = 5;

export async function runBackup(
  client: NotionClient,
  rootPageId: string,
  storage: any
): Promise<Manifest> {
  const manifest = createManifest();

  // 0. 读取上次 manifest（用于增量检测）
  let prevManifest: Manifest | null = null;
  try {
    const prevData = await storage.read('manifest.json');
    if (prevData) {
      prevManifest = JSON.parse(prevData);
      logger.info('📋 已加载上次备份的 manifest');
    }
  } catch {
    // 首次备份，没有 manifest
  }

  // 1. 发现页面树
  logger.info('🔍 开始扫描 Notion 页面树...');
  const tree = await discoverTree(client, rootPageId, (msg) => logger.info(msg));
  const allNodes = flattenTree(tree);
  logger.info(`📊 发现 ${allNodes.length} 个节点（页面 + 数据库）\n`);

  // 1b. 增量检测
  const skipSet = new Set<string>();
  if (prevManifest) {
    const prevMap = new Map(prevManifest.success.map(e => [e.id, e]));
    let skipped = 0;
    for (const node of allNodes) {
      const prev = prevMap.get(node.id);
      if (prev && prev.lastEdited === node.lastEditedTime) {
        skipSet.add(node.id);
        skipped++;
        // 保留上次的数据，直接记录到 manifest
        addSuccess(manifest, prev);
      }
    }
    if (skipped > 0) {
      logger.info(`⚡ 增量检测: 跳过 ${skipped} 个未变化的页面\n`);
    }
  }

  // 2. 逐个导出（跳过未变化的）
  logger.info('📦 开始导出...\n');

  for (const node of allNodes) {
    if (skipSet.has(node.id)) continue;

    try {
      if (node.type === 'page') {
        await exportPage(client, node, storage, manifest);
      } else if (node.type === 'database') {
        await exportDb(client, node, storage, manifest);
      }
      consecutive401 = 0; // 成功则重置
    } catch (e: any) {
      // 检测 401 连续失败
      if (e.status === 401 || e.apiError === 'unauthorized') {
        consecutive401++;
        if (consecutive401 >= MAX_401) {
          logger.error(`连续 ${MAX_401} 个页面返回 401，token 可能已过期。中止备份。`);
          logger.error('请重新运行: notion-snap init');
          break;
        }
      }

      logger.warn(`⚠️ 导出失败: ${node.title} (${node.id}): ${e.message}`);
      addFailure(manifest, {
        id: node.id,
        title: node.title,
        error: e.message,
        retryCount: 0,
      });
    }
  }

  // 3. 写入 manifest
  finalizeManifest(manifest);
  await storage.writeJson('manifest.json', manifest);

  // 4. 打印摘要
  console.log(printSummary(manifest));

  return manifest;
}

/**
 * 导出单个页面
 */
async function exportPage(
  client: NotionClient,
  node: { id: string; title: string; url: string; lastEditedTime: string; icon?: any },
  storage: any,
  manifest: Manifest
): Promise<void> {
  logger.info(`📄 导出页面: ${node.title}`);

  // 获取页面信息
  const page = await client.getPage(node.id);

  // 获取完整 block 树（递归）
  const blocks = await client.getBlockTree(node.id);

  // 生成路径
  const dirName = pagePath(node.title, node.id);

  // 生成 Markdown
  let md = '';
  // 页面标题作为 H1
  md += `# ${node.title}\n\n`;
  if (node.url) md += `> Notion URL: ${node.url}\n`;
  md += `> 最后编辑: ${node.lastEditedTime}\n\n`;
  md += blocksToMarkdown(blocks);

  // 生成 JSON 快照
  const json = pageToJson(page, blocks);
  const hash = computeHash(json);

  // 写入文件
  await storage.write(`${dirName}/page.md`, md);
  await storage.writeJson(`${dirName}/page.json`, json);

  // 记录到 manifest
  addSuccess(manifest, {
    id: node.id,
    title: node.title,
    type: 'page',
    hash,
    lastEdited: node.lastEditedTime,
    path: `${dirName}/page.json`,
  });
}

/**
 * 导出数据库
 */
async function exportDb(
  client: NotionClient,
  node: { id: string; title: string; url: string; lastEditedTime: string; icon?: any },
  storage: any,
  manifest: Manifest
): Promise<void> {
  logger.info(`🗄️  导出数据库: ${node.title}`);

  const { md, json } = await exportDatabase(client, node.id);
  const hash = computeHash(json);

  const dirName = pagePath(node.title, node.id);
  await storage.write(`${dirName}/database.md`, md);
  await storage.writeJson(`${dirName}/database.json`, json);

  addSuccess(manifest, {
    id: node.id,
    title: node.title,
    type: 'database',
    hash,
    lastEdited: node.lastEditedTime,
    path: `${dirName}/database.json`,
  });
}