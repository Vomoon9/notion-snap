/**
 * notion/client.ts — Notion API 客户端
 * OAuth 认证 + fetch 直接调 API（绕过 SDK bug）
 *
 * 关键坑位：
 * - SDK 的 databases.retrieve() 可能返回不含 properties → 用 fetch
 * - OAuth scope 是空格分隔，不是逗号
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { URL } from 'url';
import { rateLimit, withRetry } from './rate-limit';

const NOTION_VERSION = '2022-06-28';

// OAuth scope — 空格分隔！不是逗号！
const OAUTH_SCOPES = 'page.content.read page.content.write page.properties.read page.properties.write';

const CREDENTIALS_DIR = path.join(process.env.HOME || '~', '.notion-snap');
const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, 'credentials.json');

export interface Credentials {
  access_token: string;
  token_type: string;
  bot_id?: string;
  workspace_id?: string;
  workspace_name?: string;
  workspace_icon?: string;
  owner?: any;
  _savedAt?: string;
}

/**
 * 加载已保存的 OAuth 凭证
 */
export function loadCredentials(): Credentials {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      '未找到 Notion 凭证。请先运行: notion-snap init\n' +
      `预期路径: ${CREDENTIALS_PATH}`
    );
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
}

/**
 * 保存 OAuth 凭证（文件权限 0600）
 */
export function saveCredentials(creds: Credentials): void {
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }
  creds._savedAt = new Date().toISOString();
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
  console.log(`✅ 凭证已保存到 ${CREDENTIALS_PATH}`);
}

/**
 * Notion API 客户端
 */
export class NotionClient {
  private accessToken: string;
  public workspaceName: string;

  constructor(creds?: Credentials) {
    const c = creds || loadCredentials();
    this.accessToken = c.access_token;
    this.workspaceName = c.workspace_name || '(unknown)';
  }

  /**
   * 用 fetch 直接调 Notion API（绕过 SDK bug）
   * SDK 的 databases.retrieve() 可能返回不含 properties 的对象
   */
  async fetchAPI(method: string, apiPath: string, body?: any): Promise<any> {
    await rateLimit();
    return withRetry(async () => {
      const resp = await fetch(`https://api.notion.com${apiPath}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data: any = await resp.json();
      if (data.object === 'error') {
        const err = new Error(`${data.code}: ${data.message}`) as any;
        err.status = resp.status;
        err.apiError = data.code;
        throw err;
      }
      return data;
    });
  }

  // === 高级 API 方法 ===

  /** 获取页面信息 */
  async getPage(pageId: string): Promise<any> {
    return this.fetchAPI('GET', `/v1/pages/${pageId}`);
  }

  /** 获取数据库信息（含 properties/schema） */
  async getDatabase(dbId: string): Promise<any> {
    return this.fetchAPI('GET', `/v1/databases/${dbId}`);
  }

  /** 查询数据库条目（自动分页） */
  async queryDatabase(dbId: string, startCursor?: string): Promise<any> {
    return this.fetchAPI('POST', `/v1/databases/${dbId}/query`, {
      page_size: 100,
      start_cursor: startCursor || undefined,
    });
  }

  /** 列出块的所有子块（自动分页） */
  async listChildren(blockId: string): Promise<any[]> {
    const all: any[] = [];
    let cursor: string | undefined;
    do {
      const data = await this.fetchAPI(
        'GET',
        `/v1/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
      );
      all.push(...data.results);
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);
    return all;
  }

  /** 获取页面的完整 block 树（递归） */
  async getBlockTree(blockId: string): Promise<any[]> {
    const children = await this.listChildren(blockId);
    for (const child of children) {
      if (child.has_children) {
        child.children = await this.getBlockTree(child.id);
      }
    }
    return children;
  }
}

// === OAuth 授权流程 ===

/**
 * 启动 OAuth 授权流程
 * @param clientId Notion OAuth Client ID
 * @param clientSecret Notion OAuth Client Secret
 * @param redirectUri 回调 URI（默认 http://localhost:3000/oauth/callback）
 */
export async function runOAuthFlow(
  clientId: string,
  clientSecret: string,
  redirectUri: string = 'http://localhost:3000/oauth/callback'
): Promise<Credentials> {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    owner: 'user',
    redirect_uri: redirectUri,
    scope: OAUTH_SCOPES,
  });
  const authUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;

  console.log('\n🔗 请在浏览器中打开以下链接进行授权：\n');
  console.log(authUrl);
  console.log('\n⚠️  授权时请选择你要备份的 Notion 工作空间！\n');

  // 自动打开浏览器
  try {
    const { exec } = require('child_process');
    exec(`open "${authUrl}"`);
    console.log('🌐 浏览器已自动打开\n');
  } catch {
    console.log('⚠️  无法自动打开浏览器，请手动复制链接到浏览器。\n');
  }

  console.log('⏳ 等待授权回调...\n');

  // 启动本地服务器接收回调
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = new URL(req.url || '', 'http://localhost:3000');

      if (url.pathname === '/oauth/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>❌ 授权失败</h1><p>${error}</p>`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>❌ 没有收到 code</h1>');
          server.close();
          reject(new Error('No code received'));
          return;
        }

        try {
          console.log('🔄 正在交换 token...');
          const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
          const tokenResp = await fetch('https://api.notion.com/v1/oauth/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${authHeader}`,
            },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              code,
              redirect_uri: redirectUri,
            }),
          });
          const tokenData = await tokenResp.json() as Credentials;

          saveCredentials(tokenData);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <h1>✅ 授权成功！</h1>
            <p>可以关闭此页面了。</p>
            <p>工作空间: ${tokenData.workspace_name || '(unknown)'}</p>
            <p>用户: ${tokenData.owner?.user?.name || '(unknown)'}</p>
          `);

          console.log(`✅ 授权成功！工作空间: ${tokenData.workspace_name}`);
          server.close();
          resolve(tokenData);
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>❌ Token 交换失败</h1><p>${e.message}</p>`);
          server.close();
          reject(e);
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(3000, () => {
      console.log('📡 本地回调服务监听在 http://localhost:3000');
    });

    // 5 分钟超时
    setTimeout(() => {
      server.close();
      reject(new Error('授权超时（5分钟），请重新运行'));
    }, 5 * 60 * 1000);
  });
}