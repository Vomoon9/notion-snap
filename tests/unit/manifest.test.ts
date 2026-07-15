/**
 * tests/unit/manifest.test.ts — manifest 生成测试
 */

import { describe, it, expect } from 'vitest';
import { createManifest, addSuccess, addFailure, finalizeManifest, printSummary } from '../../src/exporter/manifest';

describe('manifest', () => {
  it('createManifest 初始化正确', () => {
    const m = createManifest();
    expect(m.stats.success).toBe(0);
    expect(m.stats.failed).toBe(0);
    expect(m.stats.skipped).toBe(0);
    expect(m.success).toEqual([]);
    expect(m.failed).toEqual([]);
  });

  it('addSuccess 增加成功记录', () => {
    const m = createManifest();
    addSuccess(m, {
      id: 'abc', title: 'Test', type: 'page', hash: 'xxx', lastEdited: '2024-01-01', path: 'Test-abc/page.json'
    });
    expect(m.stats.success).toBe(1);
    expect(m.success).toHaveLength(1);
    expect(m.success[0].title).toBe('Test');
  });

  it('addFailure 增加失败记录', () => {
    const m = createManifest();
    addFailure(m, { id: 'def', title: 'Failed', error: 'rate limited', retryCount: 0 });
    expect(m.stats.failed).toBe(1);
    expect(m.failed).toHaveLength(1);
    expect(m.failed[0].error).toBe('rate limited');
  });

  it('printSummary 无失败', () => {
    const m = createManifest();
    addSuccess(m, { id: 'a', title: 'P1', type: 'page', hash: 'h', lastEdited: '2024-01-01', path: 'P1-a/page.json' });
    addSuccess(m, { id: 'b', title: 'P2', type: 'page', hash: 'h', lastEdited: '2024-01-01', path: 'P2-b/page.json' });
    const summary = printSummary(m);
    expect(summary).toContain('2 成功');
    expect(summary).not.toContain('失败');
  });

  it('printSummary 有失败', () => {
    const m = createManifest();
    addSuccess(m, { id: 'a', title: 'P1', type: 'page', hash: 'h', lastEdited: '2024-01-01', path: 'P1-a/page.json' });
    addFailure(m, { id: 'b', title: 'P2', error: 'timeout', retryCount: 0 });
    const summary = printSummary(m);
    expect(summary).toContain('1 成功');
    expect(summary).toContain('1 失败');
    expect(summary).toContain('P2');
    expect(summary).toContain('timeout');
  });
});