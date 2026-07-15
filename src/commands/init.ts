/**
 * commands/init.ts — notion-snap init
 * OAuth 授权流程
 */

import { runOAuthFlow, loadCredentials } from '../notion/client';
import { logger } from '../utils/logger';

export async function initCommand(
  clientId: string,
  clientSecret: string
): Promise<void> {
  console.log('═══════════════════════════════════════');
  console.log('  🫧 NotionSnap — OAuth 授权');
  console.log('═══════════════════════════════════════\n');

  // 检查已有凭证
  try {
    const existing = loadCredentials();
    if (existing.access_token) {
      console.log('⚠️  已有授权凭证:');
      console.log(`   工作空间: ${existing.workspace_name || '(unknown)'}`);
      console.log(`   保存时间: ${existing._savedAt}`);
      console.log('   如需重新授权，请删除 ~/.notion-snap/credentials.json\n');
    }
  } catch {
    // 没有凭证，继续
  }

  if (!clientId || !clientSecret) {
    console.error('❌ 需要 Notion OAuth Client ID 和 Client Secret');
    console.error('   请在 Notion 创建 Integration: https://www.notion.so/my-integrations');
    console.error('   然后通过环境变量或 .env 文件提供:');
    console.error('   NOTION_OAUTH_CLIENT_ID=your_client_id');
    console.error('   NOTION_OAUTH_CLIENT_SECRET=your_client_secret');
    process.exit(1);
  }

  try {
    await runOAuthFlow(clientId, clientSecret);
    console.log('\n🎉 授权完成！现在可以运行备份了:');
    console.log('   notion-snap backup --root <根页面ID>');
    process.exit(0);
  } catch (e: any) {
    logger.error(`授权失败: ${e.message}`);
    process.exit(1);
  }
}