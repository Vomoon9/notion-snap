/**
 * restore-runner.ts — 恢复流程编排
 * 从 JSON 快照恢复页面/数据库到 Notion
 *
 * 关键坑位：
 * - Table block 创建必须带 children (rows)
 * - Null 值需递归清理
 * - Select/Status 属性只传 name 不传 id
 * - relation/people/formula/rollup/created_time/last_edited_time 跳过
 */

import * as fs from 'fs';
import * as path from 'path';
import { NotionClient } from '../notion/client';
import { logger } from '../utils/logger';

// 不支持创建的 block 类型
const UNSUPPORTED_TYPES = [
  'meeting_notes',
  'transcription',
  'table_of_contents',
  'ai_block',
];

// 递归清理 null/undefined
function cleanNulls(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) return obj.map(cleanNulls).filter(v => v !== undefined);
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [k, v] of Object.entries(obj)) {
      const cv = cleanNulls(v);
      if (cv !== undefined) cleaned[k] = cv;
    }
    return cleaned;
  }
  return obj;
}

interface RestoreResult {
  restored: number;
  failed: number;
  errors: string[];
}

export async function runRestore(
  client: NotionClient,
  backupDir: string,
  destParentPageId: string,
  options: { dryRun?: boolean; onlyIds?: string[] } = {}
): Promise<RestoreResult> {
  const result: RestoreResult = { restored: 0, failed: 0, errors: [] };
  const idMap = new Map<string, string>(); // 原始 ID → 新 ID

  logger.info(`🔄 开始恢复到目标页面: ${destParentPageId}`);
  if (options.dryRun) logger.info('⚠️  DRY RUN 模式 — 不会实际创建任何内容');

  // 读取 manifest
  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`未找到 manifest.json: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  logger.info(`📋 manifest: ${manifest.success.length} 个成功条目`);

  // 按目录结构恢复
  for (const entry of manifest.success) {
    if (options.onlyIds && !options.onlyIds.includes(entry.id)) {
      continue;
    }

    try {
      if (entry.type === 'page') {
        await restorePage(client, backupDir, entry, destParentPageId, idMap, options.dryRun || false);
      } else if (entry.type === 'database') {
        await restoreDatabase(client, backupDir, entry, destParentPageId, idMap, options.dryRun || false);
      }
      result.restored++;
    } catch (e: any) {
      logger.warn(`⚠️ 恢复失败: ${entry.title} — ${e.message}`);
      result.failed++;
      result.errors.push(`${entry.title}: ${e.message}`);
    }
  }

  logger.info(`\n📊 恢复摘要: ✅ ${result.restored} 成功, ❌ ${result.failed} 失败`);
  return result;
}

/**
 * 从 JSON 快照恢复一个页面
 */
async function restorePage(
  client: NotionClient,
  backupDir: string,
  entry: any,
  destParentId: string,
  idMap: Map<string, string>,
  dryRun: boolean
): Promise<void> {
  const jsonPath = path.join(backupDir, entry.path);
  const pageData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  logger.info(`📄 恢复页面: ${pageData.title}`);

  if (dryRun) {
    logger.info(`   [DRY RUN] 将创建页面 "${pageData.title}" 下 ${pageData.children?.length || 0} 个块`);
    return;
  }

  // 创建页面
  const newPage = await client.fetchAPI('POST', '/v1/pages', {
    parent: { page_id: destParentId },
    properties: {
      title: [{ text: { content: pageData.title } }],
    },
    icon: pageData.icon || undefined,
    cover: pageData.cover || undefined,
  });

  idMap.set(pageData.id, newPage.id);
  logger.info(`   → 新页面 ID: ${newPage.id}`);

  // 恢复子块
  if (pageData.children && pageData.children.length > 0) {
    for (const block of pageData.children) {
      if (block.type === 'child_page' || block.type === 'child_database') continue;
      await restoreBlock(client, block, newPage.id, idMap);
    }
  }
}

/**
 * 从 JSON 快照恢复一个数据库
 */
async function restoreDatabase(
  client: NotionClient,
  backupDir: string,
  entry: any,
  destParentId: string,
  idMap: Map<string, string>,
  dryRun: boolean
): Promise<void> {
  const jsonPath = path.join(backupDir, entry.path);
  const dbData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  logger.info(`🗄️  恢复数据库: ${dbData.title} (${dbData.entries?.length || 0} 条目)`);

  if (dryRun) {
    logger.info(`   [DRY RUN] 将创建数据库 "${dbData.title}" + ${dbData.entries?.length || 0} 个条目`);
    return;
  }

  // 构建 schema
  const properties: any = {};
  for (const [propName, prop] of Object.entries(dbData.schema || {})) {
    const p = prop as any;
    const newProp: any = { type: p.type };

    if (p.type === 'select' && p.select?.options) {
      newProp.select = { options: p.select.options.map((o: any) => ({ name: o.name, color: o.color })) };
    } else if (p.type === 'multi_select' && p.multi_select?.options) {
      newProp.multi_select = { options: p.multi_select.options.map((o: any) => ({ name: o.name, color: o.color })) };
    } else if (p.type === 'status' && p.status?.options) {
      newProp.status = { options: p.status.options.map((o: any) => ({ name: o.name, color: o.color })) };
    } else if (p.type === 'number' && p.number) {
      newProp.number = { format: p.number.format };
    } else if (['rich_text', 'title', 'date', 'checkbox', 'url', 'email', 'phone_number', 'files', 'people', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by'].includes(p.type)) {
      newProp[p.type] = {};
    } else if (p.type === 'formula' && p.formula) {
      newProp.formula = { expression: p.formula.expression };
    } else if (p.type === 'rollup' || p.type === 'relation') {
      continue; // 跨空间不通用，跳过
    }

    properties[propName] = newProp;
  }

  // 创建数据库
  const newDb = await client.fetchAPI('POST', '/v1/databases', {
    parent: { page_id: destParentId },
    title: [{ text: { content: dbData.title } }],
    properties,
    icon: dbData.icon || undefined,
    cover: dbData.cover || undefined,
  });

  idMap.set(dbData.id, newDb.id);
  logger.info(`   → 新数据库 ID: ${newDb.id}`);

  // 恢复条目
  for (const entry of (dbData.entries || [])) {
    try {
      await restoreDbEntry(client, entry, newDb.id, idMap);
    } catch (e: any) {
      logger.warn(`     ⚠️ 条目恢复失败: ${e.message.substring(0, 100)}`);
    }
  }
}

/**
 * 恢复数据库条目（一个 page）
 * 关键：属性值只传 value 部分，select/status 按 name 匹配
 */
async function restoreDbEntry(
  client: NotionClient,
  entry: any,
  destDbId: string,
  idMap: Map<string, string>
): Promise<void> {
  const properties: any = {};

  for (const [propName, prop] of Object.entries(entry.properties || {})) {
    const p = prop as any;
    try {
      if (p.type === 'title' && p.title) {
        properties[propName] = { title: cleanNulls(p.title) };
      } else if (p.type === 'rich_text' && p.rich_text !== undefined) {
        properties[propName] = { rich_text: cleanNulls(p.rich_text) || [] };
      } else if (p.type === 'select' && p.select) {
        properties[propName] = { select: { name: p.select.name } };
      } else if (p.type === 'multi_select' && p.multi_select) {
        properties[propName] = { multi_select: p.multi_select.map((o: any) => ({ name: o.name })) };
      } else if (p.type === 'status' && p.status) {
        properties[propName] = { status: { name: p.status.name } };
      } else if (p.type === 'date' && p.date) {
        properties[propName] = { date: cleanNulls(p.date) };
      } else if (p.type === 'number' && p.number !== undefined && p.number !== null) {
        properties[propName] = { number: p.number };
      } else if (p.type === 'checkbox') {
        properties[propName] = { checkbox: p.checkbox };
      } else if (p.type === 'url' && p.url) {
        properties[propName] = { url: p.url };
      } else if (p.type === 'email' && p.email) {
        properties[propName] = { email: p.email };
      } else if (p.type === 'phone_number' && p.phone_number) {
        properties[propName] = { phone_number: p.phone_number };
      } else if (p.type === 'files' && p.files) {
        properties[propName] = { files: cleanNulls(p.files) || [] };
      }
      // relation, people, formula, rollup, created_*, last_edited_* — 跳过
    } catch (e: any) {
      logger.warn(`     ⚠️ 属性 "${propName}" 转换失败: ${e.message.substring(0, 80)}`);
    }
  }

  const newPage = await client.fetchAPI('POST', '/v1/pages', {
    parent: { database_id: destDbId },
    properties,
  });

  idMap.set(entry.id, newPage.id);

  // 恢复条目的内容块
  if (entry.children && entry.children.length > 0) {
    for (const block of entry.children) {
      if (block.type === 'child_page' || block.type === 'child_database') continue;
      await restoreBlock(client, block, newPage.id, idMap);
    }
  }
}

/**
 * 恢复单个 block 到目标父块下
 */
async function restoreBlock(
  client: NotionClient,
  block: any,
  destParentId: string,
  idMap: Map<string, string>,
  depth: number = 0
): Promise<string | null> {
  const type = block.type;
  if (!type || UNSUPPORTED_TYPES.includes(type)) {
    return null;
  }

  // 特殊处理 table — 必须带 children rows
  if (type === 'table') {
    return await restoreTableBlock(client, block, destParentId, idMap);
  }

  // 通用 block
  if (!block[type]) return null;

  let blockData = cleanNulls(block[type]);

  const newBlock: any = {
    object: 'block',
    type,
    [type]: blockData,
  };

  try {
    const result = await client.fetchAPI('PATCH', `/v1/blocks/${destParentId}/children`, {
      children: [newBlock],
    });
    const created = Array.isArray(result.results) ? result.results[0] : result;
    const newId = created.id;
    idMap.set(block.id, newId);

    // 递归恢复子块
    if (block.children && block.children.length > 0 && type !== 'child_page' && type !== 'child_database') {
      for (const child of block.children) {
        if (child.type === 'child_page' || child.type === 'child_database') continue;
        await restoreBlock(client, child, newId, idMap, depth + 1);
      }
    }

    return newId;
  } catch (e: any) {
    logger.warn(`  ❌ 块创建失败 [${type}]: ${e.message.substring(0, 150)}`);
    return null;
  }
}

/**
 * 恢复 table block — 创建时必须带所有 rows
 */
async function restoreTableBlock(
  client: NotionClient,
  block: any,
  destParentId: string,
  idMap: Map<string, string>
): Promise<string | null> {
  const rows = block.children || [];

  const tableData = {
    table_width: block.table?.table_width || 1,
    has_column_header: block.table?.has_column_header || false,
    has_row_header: block.table?.has_row_header || false,
    children: rows.map((row: any) => ({
      type: 'table_row',
      table_row: { cells: row.table_row?.cells || [] },
    })),
  };

  try {
    const result = await client.fetchAPI('PATCH', `/v1/blocks/${destParentId}/children`, {
      children: [{
        object: 'block',
        type: 'table',
        table: tableData,
      }],
    });
    const created = Array.isArray(result.results) ? result.results[0] : result;
    idMap.set(block.id, created.id);
    return created.id;
  } catch (e: any) {
    logger.warn(`  ❌ table 创建失败: ${e.message.substring(0, 150)}`);
    return null;
  }
}