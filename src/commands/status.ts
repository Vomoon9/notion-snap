/**
 * commands/status.ts — notion-snap status
 * 查看当前凭证状态和上次备份信息
 */

import { loadCredentials } from '../notion/client';
import { logger } from '../utils/logger';

export async function statusCommand(): Promise<void> {
  console.log('═══════════════════════════════════════');
  console.log('  🫧 NotionSnap — 状态');
  console.log('═══════════════════════════════════════\n');

  // 检查凭证
  try {
    const creds = loadCredentials();
    console.log('✅ OAuth 凭证:');
    console.log(`   工作空间: ${creds.workspace_name || '(unknown)'}`);
    console.log(`   工作空间 ID: ${creds.workspace_id || '(unknown)'}`);
    console.log(`   保存时间: ${creds._savedAt || '(unknown)'}`);
    console.log(`   凭证路径: ~/.notion-snap/credentials.json`);
  } catch {
    console.log('❌ 未找到 OAuth 凭证');
    console.log('   请先运行: notion-snap init');
  }
}