/**
 * tests/unit/slug.test.ts — slug 和路径命名测试
 */

import { describe, it, expect } from 'vitest';
import { slugify, pagePath } from '../../src/utils/slug';

describe('slugify', () => {
  it('英文标题', () => {
    expect(slugify('My Page Title')).toBe('My-Page-Title');
  });

  it('中文标题', () => {
    expect(slugify('希沃白板公约')).toBe('希沃白板公约');
  });

  it('混合中英文', () => {
    expect(slugify('Claude 任务')).toBe('Claude-任务');
  });

  it('特殊字符过滤', () => {
    expect(slugify('Hello! @World #2024')).toBe('Hello-World-2024');
  });

  it('多空格合并', () => {
    expect(slugify('Multiple   Spaces')).toBe('Multiple-Spaces');
  });

  it('限制长度', () => {
    const long = 'A'.repeat(100);
    expect(slugify(long).length).toBe(50);
  });

  it('空字符串兜底', () => {
    expect(slugify('')).toBe('untitled');
  });

  it('只有特殊字符', () => {
    expect(slugify('!@#$%')).toBe('untitled');
  });
});

describe('pagePath', () => {
  it('生成确定性路径', () => {
    const p = pagePath('My Page', 'abc12345-6789-def0-1234-567890abcdef');
    expect(p).toBe('My-Page-abc12345');
  });

  it('相同输入相同输出', () => {
    const p1 = pagePath('Test', 'abcdef12-3456-7890-abcd-ef1234567890');
    const p2 = pagePath('Test', 'abcdef12-3456-7890-abcd-ef1234567890');
    expect(p1).toBe(p2);
  });

  it('不同 pageId 不同路径', () => {
    const p1 = pagePath('Test', 'aaaa1111-0000-0000-0000-000000000000');
    const p2 = pagePath('Test', 'bbbb2222-0000-0000-0000-000000000000');
    expect(p1).not.toBe(p2);
  });
});