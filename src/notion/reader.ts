/**
 * 页面树递归读取器
 *
 * 核心函数：discoverTree(client, rootPageId) → PageTreeNode
 */

import { NotionClient } from './client';
import { PageTreeNode } from './types';

/**
 * 提取页面标题
 */
export function getPageTitle(page: any): string {
  if (!page.properties) return '(无标题)';
  for (const key of Object.keys(page.properties)) {
    const prop = page.properties[key];
    if (prop.type === 'title' && prop.title?.[0]?.plain_text) {
      return prop.title.map((t: any) => t.plain_text).join('');
    }
  }
  return '(无标题)';
}

/**
 * 提取数据库标题
 */
export function getDatabaseTitle(db: any): string {
  if (db.title?.[0]?.plain_text) {
    return db.title.map((t: any) => t.plain_text).join('');
  }
  return '(无标题)';
}

/**
 * 递归发现页面树（不含 block 内容，只发现结构）
 * block 内容在导出阶段再获取，避免一次性加载太多到内存
 */
export async function discoverTree(
  client: NotionClient,
  rootPageId: string,
  onProgress?: (msg: string) => void
): Promise<PageTreeNode> {
  return scanPage(client, rootPageId, 0, onProgress);
}

async function scanPage(
  client: NotionClient,
  pageId: string,
  depth: number,
  onProgress?: (msg: string) => void
): Promise<PageTreeNode> {
  const page = await client.getPage(pageId);
  const title = getPageTitle(page);

  if (onProgress) onProgress(`${'  '.repeat(depth)}📄 ${title}`);

  const children = await client.listChildren(pageId);
  const childNodes: PageTreeNode[] = [];

  for (const block of children) {
    if (block.type === 'child_page') {
      childNodes.push(await scanPage(client, block.id, depth + 1, onProgress));
    } else if (block.type === 'child_database') {
      childNodes.push(await scanDatabase(client, block.id, depth + 1, onProgress));
    }
  }

  return {
    id: pageId,
    type: 'page',
    title,
    url: page.url || `https://notion.so/${pageId.replace(/-/g, '')}`,
    lastEditedTime: page.last_edited_time,
    icon: page.icon,
    children: childNodes,
  };
}

async function scanDatabase(
  client: NotionClient,
  dbId: string,
  depth: number,
  onProgress?: (msg: string) => void
): Promise<PageTreeNode> {
  const db = await client.getDatabase(dbId);
  const title = getDatabaseTitle(db);

  if (onProgress) onProgress(`${'  '.repeat(depth)}🗄️  ${title} (database)`);

  // 数据库的子节点是它的条目（pages）
  // 但在发现阶段我们不递归进入每个条目——太慢
  // 条目在导出阶段获取
  return {
    id: dbId,
    type: 'database',
    title,
    url: db.url || `https://notion.so/${dbId.replace(/-/g, '')}`,
    lastEditedTime: db.last_edited_time,
    icon: db.icon,
    children: [], // 数据库条目在导出阶段填充
  };
}

/**
 * 扁平化页面树为列表
 */
export function flattenTree(tree: PageTreeNode): PageTreeNode[] {
  const list: PageTreeNode[] = [];
  function walk(node: PageTreeNode) {
    list.push(node);
    if (node.children) node.children.forEach(walk);
  }
  walk(tree);
  return list;
}