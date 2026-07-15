/**
 * exporter/manifest.ts — manifest.json 生成
 * 记录本次备份的元数据：成功/失败页面列表、时间戳、哈希
 */

import { Manifest, ManifestEntry, ManifestFailed } from '../notion/types';

export function createManifest(): Manifest {
  return {
    timestamp: new Date().toISOString(),
    stats: { success: 0, failed: 0, skipped: 0 },
    success: [],
    failed: [],
  };
}

export function addSuccess(
  manifest: Manifest,
  entry: ManifestEntry
): void {
  manifest.success.push(entry);
  manifest.stats.success++;
}

export function addFailure(
  manifest: Manifest,
  entry: ManifestFailed
): void {
  manifest.failed.push(entry);
  manifest.stats.failed++;
}

export function finalizeManifest(manifest: Manifest): Manifest {
  manifest.timestamp = new Date().toISOString();
  return manifest;
}

/**
 * 打印备份摘要
 */
export function printSummary(manifest: Manifest): string {
  const { success, failed, skipped } = manifest.stats;
  let summary = `\n📊 备份摘要: ✅ ${success} 成功`;
  if (failed > 0) summary += `, ⚠️ ${failed} 失败`;
  if (skipped > 0) summary += `, ⏭️ ${skipped} 跳过`;
  summary += ` — ${manifest.timestamp}`;

  if (failed > 0) {
    summary += '\n\n失败页面:';
    for (const f of manifest.failed) {
      summary += `\n  ⚠️ ${f.title} (${f.id}): ${f.error}`;
    }
  }
  return summary;
}