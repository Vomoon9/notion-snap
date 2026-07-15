/**
 * exporter/json-snapshot.ts — JSON 快照生成
 * 每个页面/数据库导出完整 JSON 结构（用于 Restore）
 * JSON key 按字母排序，保证 diff 稳定
 */

import * as crypto from 'crypto';

import { getPageTitle, getDatabaseTitle } from '../notion/reader';

/**
 * 生成页面的 JSON 快照
 */
export function pageToJson(page: any, blocks: any[]): any {
  const snapshot = {
    id: page.id,
    url: page.url,
    title: getPageTitle(page),
    icon: page.icon,
    cover: page.cover,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    created_by: page.created_by,
    last_edited_by: page.last_edited_by,
    parent: page.parent,
    properties: page.properties,
    children: blocks,
  };
  return sortKeysDeep(snapshot);
}

/**
 * 生成数据库的 JSON 快照（方案 B）
 * 包含 schema + 所有条目 + 每个条目的 blocks
 */
export function databaseToJson(db: any, entries: any[], entryBlocksMap: Map<string, any[]>): any {
  const snapshot = {
    id: db.id,
    title: getDatabaseTitle(db),
    url: db.url,
    icon: db.icon,
    cover: db.cover,
    created_time: db.created_time,
    last_edited_time: db.last_edited_time,
    schema: db.properties,
    entries: entries.map(entry => ({
      id: entry.id,
      url: entry.url,
      properties: entry.properties,
      created_time: entry.created_time,
      last_edited_time: entry.last_edited_time,
      children: entryBlocksMap.get(entry.id) || [],
    })),
  };
  return sortKeysDeep(snapshot);
}

/**
 * 计算对象的稳定哈希（用于增量检测）
 */
export function computeHash(obj: any): string {
  const json = JSON.stringify(sortKeysDeep(obj));
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
}

/**
 * 深度排序对象 key（保证 JSON 输出稳定 → clean diff）
 */
function sortKeysDeep(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (typeof obj === 'object') {
    const sorted: any = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeysDeep(obj[key]);
    }
    return sorted;
  }
  return obj;
}