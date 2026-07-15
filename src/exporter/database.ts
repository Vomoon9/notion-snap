/**
 * exporter/database.ts — 数据库导出（方案 B）
 * 一个数据库 = 两个文件：
 *   database.md   ← schema 摘要 + 条目索引表格（人看）
 *   database.json ← 完整 API 数据（Restore 用）
 */

import { NotionClient } from '../notion/client';
import { blocksToMarkdown, richTextToMarkdown } from './markdown';
import { databaseToJson } from './json-snapshot';
import { getPageTitle, getDatabaseTitle } from '../notion/reader';

/**
 * 导出数据库
 * @param client NotionClient
 * @param dbId 数据库 ID
 * @returns { md: string, json: object }
 */
export async function exportDatabase(
  client: NotionClient,
  dbId: string
): Promise<{ md: string; json: any }> {
  // 1. 获取数据库 schema
  const db = await client.getDatabase(dbId);

  // 2. 查询所有条目（自动分页）
  const allEntries: any[] = [];
  let cursor: string | undefined;
  do {
    const resp = await client.queryDatabase(dbId, cursor);
    allEntries.push(...(resp.results || []));
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);

  // 3. 获取每个条目的 block 内容
  const entryBlocksMap = new Map<string, any[]>();
  for (const entry of allEntries) {
    try {
      const blocks = await client.getBlockTree(entry.id);
      entryBlocksMap.set(entry.id, blocks);
    } catch (e: any) {
      // 单个条目 block 获取失败不中断
      entryBlocksMap.set(entry.id, []);
    }
  }

  // 4. 生成 database.json（完整 API 数据）
  const json = databaseToJson(db, allEntries, entryBlocksMap);

  // 5. 生成 database.md（人类可读索引）
  const md = generateDatabaseMd(db, allEntries);

  return { md, json };
}

/**
 * 生成 database.md — schema 摘要 + 条目索引表格
 */
function generateDatabaseMd(db: any, entries: any[]): string {
  const title = getDatabaseTitle(db);
  const url = db.url || '';
  const lastEdited = db.last_edited_time || '';
  const entryCount = entries.length;

  let md = `# ${title}\n\n`;
  md += `> Notion URL: ${url}\n`;
  md += `> 最后编辑: ${lastEdited}\n`;
  md += `> 条目数: ${entryCount}\n\n`;

  // Schema 表格
  md += `## Schema\n\n`;
  md += `| 属性名 | 类型 | 说明 |\n`;
  md += `|---|---|---|\n`;
  if (db.properties) {
    for (const [name, prop] of Object.entries(db.properties)) {
      const type = (prop as any).type || 'unknown';
      md += `| ${name} | ${type} | — |\n`;
    }
  }
  md += '\n';

  // 条目索引表格
  md += `## 条目索引\n\n`;
  if (entryCount === 0) {
    md += `(空数据库)\n`;
    return md;
  }

  // 收集属性名作为表头（最多 5 列，排除 title 类型——title 已经是"名称"列）
  const propNames = Object.entries(db.properties || {})
    .filter((entry: [string, any]) => entry[1].type !== 'title')
    .map((entry: [string, any]) => entry[0])
    .slice(0, 5);
  const headerCells = ['名称', ...propNames, '最后编辑'];
  md += `| ${headerCells.join(' | ')} |\n`;
  md += `| ${headerCells.map(() => '---').join(' | ')} |\n`;

  for (const entry of entries) {
    const entryTitle = getPageTitle(entry);
    const cells = [entryTitle];

    for (const propName of propNames) {
      const prop = entry.properties?.[propName];
      if (!prop) {
        cells.push('');
        continue;
      }
      cells.push(propertyToText(prop));
    }

    cells.push(entry.last_edited_time?.slice(0, 10) || '');
    md += `| ${cells.join(' | ')} |\n`;
  }

  return md;
}

/**
 * 将数据库属性值转为简短文本（用于索引表格）
 */
function propertyToText(prop: any): string {
  if (!prop) return '';
  switch (prop.type) {
    case 'title':
      return (prop.title || []).map((t: any) => t.plain_text).join('');
    case 'rich_text':
      return (prop.rich_text || []).map((t: any) => t.plain_text).join('');
    case 'select':
      return prop.select?.name || '';
    case 'multi_select':
      return (prop.multi_select || []).map((s: any) => s.name).join(', ');
    case 'status':
      return prop.status?.name || '';
    case 'number':
      return prop.number != null ? String(prop.number) : '';
    case 'checkbox':
      return prop.checkbox ? '✅' : '⬜';
    case 'date':
      return prop.date?.start || '';
    case 'url':
      return prop.url || '';
    case 'email':
      return prop.email || '';
    case 'phone_number':
      return prop.phone_number || '';
    case 'people':
      return (prop.people || []).map((p: any) => p.name || '').join(', ');
    case 'files':
      return (prop.files || []).map((f: any) => f.name || '').join(', ');
    case 'relation':
      return (prop.relation || []).map((r: any) => r.id?.slice(0, 8) || '').join(', ');
    case 'formula':
      return prop.formula?.string || '';
    case 'rollup':
      return String(prop.rollup?.string || prop.rollup?.number || '');
    case 'created_time':
      return prop.created_time?.slice(0, 10) || '';
    case 'last_edited_time':
      return prop.last_edited_time?.slice(0, 10) || '';
    case 'created_by':
      return prop.created_by?.name || '';
    case 'last_edited_by':
      return prop.last_edited_by?.name || '';
    default:
      return '';
  }
}