/**
 * tests/unit/markdown.test.ts — Markdown 导出器单元测试
 * 使用 vitest
 */

import { describe, it, expect } from 'vitest';
import { blockToMarkdown, richTextToMarkdown, blocksToMarkdown } from '../../src/exporter/markdown';

describe('richTextToMarkdown', () => {
  it('普通文本', () => {
    expect(richTextToMarkdown([{ plain_text: 'Hello' }])).toBe('Hello');
  });

  it('加粗', () => {
    expect(richTextToMarkdown([{ plain_text: 'bold', annotations: { bold: true } }])).toBe('**bold**');
  });

  it('斜体', () => {
    expect(richTextToMarkdown([{ plain_text: 'italic', annotations: { italic: true } }])).toBe('*italic*');
  });

  it('代码', () => {
    expect(richTextToMarkdown([{ plain_text: 'code', annotations: { code: true } }])).toBe('`code`');
  });

  it('删除线', () => {
    expect(richTextToMarkdown([{ plain_text: 'deleted', annotations: { strikethrough: true } }])).toBe('~~deleted~~');
  });

  it('链接', () => {
    expect(richTextToMarkdown([{ plain_text: 'link', href: 'https://example.com' }])).toBe('[link](https://example.com)');
  });

  it('空数组', () => {
    expect(richTextToMarkdown([])).toBe('');
  });

  it('中文文本', () => {
    expect(richTextToMarkdown([{ plain_text: '你好世界' }])).toBe('你好世界');
  });
});

describe('blockToMarkdown', () => {
  it('paragraph', () => {
    const block = { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Hello' }] } };
    expect(blockToMarkdown(block)).toBe('Hello');
  });

  it('heading_1', () => {
    const block = { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Title' }] } };
    expect(blockToMarkdown(block)).toBe('# Title');
  });

  it('heading_2', () => {
    const block = { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Subtitle' }] } };
    expect(blockToMarkdown(block)).toBe('## Subtitle');
  });

  it('heading_3', () => {
    const block = { type: 'heading_3', heading_3: { rich_text: [{ plain_text: 'Section' }] } };
    expect(blockToMarkdown(block)).toBe('### Section');
  });

  it('bulleted_list_item', () => {
    const block = { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'item' }] } };
    expect(blockToMarkdown(block)).toBe('- item');
  });

  it('numbered_list_item', () => {
    const block = { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'step' }] } };
    expect(blockToMarkdown(block)).toBe('1. step');
  });

  it('to_do unchecked', () => {
    const block = { type: 'to_do', to_do: { checked: false, rich_text: [{ plain_text: 'task' }] } };
    expect(blockToMarkdown(block)).toBe('- [ ] task');
  });

  it('to_do checked', () => {
    const block = { type: 'to_do', to_do: { checked: true, rich_text: [{ plain_text: 'done' }] } };
    expect(blockToMarkdown(block)).toBe('- [x] done');
  });

  it('code block', () => {
    const block = { type: 'code', code: { language: 'python', rich_text: [{ plain_text: 'print("hi")' }] } };
    expect(blockToMarkdown(block)).toBe('```python\nprint("hi")\n```');
  });

  it('quote', () => {
    const block = { type: 'quote', quote: { rich_text: [{ plain_text: 'wisdom' }] } };
    expect(blockToMarkdown(block)).toBe('> wisdom');
  });

  it('callout with emoji', () => {
    const block = { type: 'callout', callout: { icon: { emoji: '💡' }, rich_text: [{ plain_text: 'tip' }] } };
    expect(blockToMarkdown(block)).toBe('> 💡 tip');
  });

  it('callout without icon', () => {
    const block = { type: 'callout', callout: { icon: null, rich_text: [{ plain_text: 'note' }] } };
    expect(blockToMarkdown(block)).toBe('> 💡 note');
  });

  it('divider', () => {
    expect(blockToMarkdown({ type: 'divider' })).toBe('---');
  });

  it('image with caption', () => {
    const block = { type: 'image', image: { file: { url: 'https://img.com/test.png' }, caption: [{ plain_text: 'alt' }] } };
    expect(blockToMarkdown(block)).toBe('![alt](https://img.com/test.png)');
  });

  it('image external', () => {
    const block = { type: 'image', image: { external: { url: 'https://ext.com/img.png' }, caption: [] } };
    expect(blockToMarkdown(block)).toBe('![](https://ext.com/img.png)');
  });

  it('bookmark', () => {
    const block = { type: 'bookmark', bookmark: { url: 'https://example.com', caption: [] } };
    expect(blockToMarkdown(block)).toBe('[https://example.com](https://example.com)');
  });

  it('bookmark with caption', () => {
    const block = { type: 'bookmark', bookmark: { url: 'https://example.com', caption: [{ plain_text: 'My Link' }] } };
    expect(blockToMarkdown(block)).toBe('[My Link](https://example.com)');
  });

  it('equation', () => {
    const block = { type: 'equation', equation: { expression: 'E = mc^2' } };
    expect(blockToMarkdown(block)).toBe('$$ E = mc^2 $$');
  });

  it('table_of_contents', () => {
    expect(blockToMarkdown({ type: 'table_of_contents' })).toBe('[目录]');
  });

  it('breadcrumb', () => {
    expect(blockToMarkdown({ type: 'breadcrumb' })).toBe('<!-- breadcrumb -->');
  });

  it('child_page', () => {
    const block = { type: 'child_page', id: 'abc12345-6789-def0', child_page: { title: 'My Page' } };
    expect(blockToMarkdown(block)).toBe('[My Page](./My-Page-abc12345/page.md)');
  });

  it('child_database', () => {
    const block = { type: 'child_database', id: 'abc12345-6789-def0', child_database: { title: 'My DB' } };
    expect(blockToMarkdown(block)).toBe('[My DB](./My-DB-abc12345/database.md)');
  });

  it('unknown block type → HTML comment, not crash', () => {
    const block = { type: 'some_future_block_type', some_future_block_type: {} };
    expect(blockToMarkdown(block)).toBe('<!-- unsupported block type: some_future_block_type -->');
  });

  it('empty paragraph', () => {
    const block = { type: 'paragraph', paragraph: { rich_text: [] } };
    expect(blockToMarkdown(block)).toBe('');
  });
});

describe('blocksToMarkdown', () => {
  it('multiple blocks joined with double newline', () => {
    const blocks = [
      { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Title' }] } },
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Body' }] } },
    ];
    expect(blocksToMarkdown(blocks)).toBe('# Title\n\nBody');
  });
});