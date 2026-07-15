/**
 * exporter/markdown.ts — Block → Markdown 转换器
 * 覆盖所有 Notion block 类型（22种 + 未知类型兜底）
 *
 * 规则：
 * - Markdown 只给人看，不追求被 Obsidian/其他工具解析
 * - 未知 block 类型输出 HTML 注释，不崩溃
 * - toggle/synced_block/column_list 需递归处理子块
 */

import { NotionBlock } from '../notion/types';
import { slugify } from '../utils/slug';

/**
 * 将 Notion block 转换为 Markdown
 * @param block Notion API 返回的 block 对象
 * @param depth 递归深度（用于缩进）
 */
export function blockToMarkdown(block: any, depth: number = 0): string {
  const indent = '  '.repeat(depth);

  switch (block.type) {
    case 'paragraph':
      return indent + richTextToMarkdown(block.paragraph?.rich_text || []);

    case 'heading_1':
      return `# ${richTextToMarkdown(block.heading_1?.rich_text || [])}`;
    case 'heading_2':
      return `## ${richTextToMarkdown(block.heading_2?.rich_text || [])}`;
    case 'heading_3':
      return `### ${richTextToMarkdown(block.heading_3?.rich_text || [])}`;

    case 'bulleted_list_item':
      return `${indent}- ${richTextToMarkdown(block.bulleted_list_item?.rich_text || [])}`;
    case 'numbered_list_item':
      return `${indent}1. ${richTextToMarkdown(block.numbered_list_item?.rich_text || [])}`;

    case 'to_do': {
      const checked = block.to_do?.checked ? '[x]' : '[ ]';
      return `${indent}- ${checked} ${richTextToMarkdown(block.to_do?.rich_text || [])}`;
    }

    case 'code': {
      const lang = block.code?.language || '';
      const code = (block.code?.rich_text || []).map((t: any) => t.plain_text).join('');
      return '```' + lang + '\n' + code + '\n```';
    }

    case 'quote':
      return `> ${richTextToMarkdown(block.quote?.rich_text || [])}`;

    case 'callout': {
      const icon = block.callout?.icon?.emoji || '💡';
      const text = richTextToMarkdown(block.callout?.rich_text || []);
      return `> ${icon} ${text}`;
    }

    case 'divider':
      return '---';

    case 'image': {
      const url = block.image?.file?.url || block.image?.external?.url || '';
      const caption = (block.image?.caption || []).map((t: any) => t.plain_text).join('');
      return `![${caption}](${url})`;
    }

    case 'bookmark': {
      const url = block.bookmark?.url || '';
      const caption = (block.bookmark?.caption || []).map((t: any) => t.plain_text).join('');
      return `[${caption || url}](${url})`;
    }

    case 'embed':
      return `[嵌入内容](${block.embed?.url || ''})`;

    case 'video':
      return `[视频](${block.video?.external?.url || block.video?.file?.url || ''})`;

    case 'audio':
      return `[音频](${block.audio?.external?.url || block.audio?.file?.url || ''})`;

    case 'file':
      return `[文件](${block.file?.external?.url || block.file?.file?.url || ''})`;

    case 'pdf':
      return `[PDF](${block.pdf?.external?.url || block.pdf?.file?.url || ''})`;

    case 'equation':
      return `$$ ${block.equation?.expression || ''} $$`;

    case 'table_of_contents':
      return `[目录]`;

    case 'toggle': {
      const title = richTextToMarkdown(block.toggle?.rich_text || []);
      const children = block.children || [];
      const childMd = children
        .map((child: any) => blockToMarkdown(child, depth + 1))
        .join('\n');
      return `<details><summary>${title}</summary>\n\n${childMd}\n\n</details>`;
    }

    case 'synced_block': {
      // 同步块：递归展开内部子块
      const children = block.children || block.synced_block?.children || [];
      return children
        .map((child: any) => blockToMarkdown(child, depth))
        .join('\n');
    }

    case 'column_list': {
      // 分栏：按顺序平铺（Markdown 不支持分栏）
      const columns = block.column_list?.children || block.children || [];
      return columns
        .map((col: any) => {
          const colChildren = col.column?.children || col.children || [];
          return colChildren
            .map((child: any) => blockToMarkdown(child, depth))
            .join('\n');
        })
        .join('\n');
    }

    case 'column': {
      // 单独的 column block（通常在 column_list 内部）
      const children = block.column?.children || block.children || [];
      return children
        .map((child: any) => blockToMarkdown(child, depth))
        .join('\n');
    }

    case 'child_page':
      return `[${block.child_page?.title || '无标题'}](./${slugify(block.child_page?.title || 'untitled')}-${block.id.replace(/-/g, '').slice(0, 8)}/page.md)`;

    case 'child_database':
      return `[${block.child_database?.title || '无标题'}](./${slugify(block.child_database?.title || 'untitled')}-${block.id.replace(/-/g, '').slice(0, 8)}/database.md)`;

    case 'link_to_page': {
      const linked = block.link_to_page;
      if (linked?.type === 'page_id') {
        return `[页面链接](https://notion.so/${(linked.page_id || '').replace(/-/g, '')})`;
      } else if (linked?.type === 'database_id') {
        return `[数据库链接](https://notion.so/${(linked.database_id || '').replace(/-/g, '')})`;
      }
      return `<!-- link_to_page: ${linked?.type || 'unknown'} -->`;
    }

    case 'breadcrumb':
      return `<!-- breadcrumb -->`;

    case 'table':
      return tableToMarkdown(block);

    default:
      return `<!-- unsupported block type: ${block.type} -->`;
  }
}

/**
 * Notion rich_text 数组 → Markdown 字符串
 * 处理加粗、斜体、代码、删除线、链接等内联格式
 */
export function richTextToMarkdown(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) return '';
  return richText.map(rt => {
    let text = rt.plain_text || '';

    if (rt.annotations?.bold) text = `**${text}**`;
    if (rt.annotations?.italic) text = `*${text}*`;
    if (rt.annotations?.code) text = `\`${text}\``;
    if (rt.annotations?.strikethrough) text = `~~${text}~~`;
    if (rt.href) text = `[${text}](${rt.href})`;

    return text;
  }).join('');
}

/**
 * Table block → Markdown table
 * Notion table 的 children 是行（table_row）
 */
function tableToMarkdown(block: any): string {
  const tableData = block.table || {};
  const rows = tableData.children || block.children || [];

  if (rows.length === 0) return '';

  // 如果 children 是 block 列表（需要从 API 获取），处理 results 格式
  const rowList = Array.isArray(rows) ? rows : (rows.results || []);

  const tableWidth = tableData.table_width || 1;
  const hasHeader = tableData.has_column_header;
  const hasRowHeader = tableData.has_row_header;

  let md = '';
  rowList.forEach((row: any, i: number) => {
    const cells = row.table_row?.cells || [];
    const cellTexts = cells.map((cell: any[]) =>
      cell.map(t => t.plain_text || '').join('')
    );

    // 补齐列数
    while (cellTexts.length < tableWidth) cellTexts.push('');

    md += `| ${cellTexts.join(' | ')} |\n`;

    if (hasHeader && i === 0) {
      md += `| ${Array(tableWidth).fill('---').join(' | ')} |\n`;
    }
  });

  return md;
}

/**
 * 将完整的 block 列表转为 Markdown 文档
 */
export function blocksToMarkdown(blocks: any[]): string {
  return blocks
    .map(block => blockToMarkdown(block))
    .join('\n\n');
}