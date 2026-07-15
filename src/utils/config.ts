/**
 * utils/config.ts — 配置文件加载
 * 支持 YAML 配置文件和环境变量
 */

import * as fs from 'fs';
import * as path from 'path';

export interface BackupConfig {
  source: {
    rootPageId: string;
  };
  storage: {
    type: 'local' | 'git';
    outputDir?: string;       // for local
    repo?: string;             // for git
    branch?: string;           // for git
  };
  export: {
    timezone?: string;
    includeDatabases?: boolean;
  };
}

export function loadConfig(configPath: string): BackupConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`配置文件不存在: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  let parsed: any;

  if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
    const YAML = require('yaml');
    parsed = YAML.parse(raw);
  } else if (configPath.endsWith('.json')) {
    parsed = JSON.parse(raw);
  } else {
    throw new Error('配置文件格式不支持，请使用 .yaml 或 .json');
  }

  // 验证必要字段
  if (!parsed.source?.rootPageId) {
    throw new Error('配置缺少 source.rootPageId');
  }
  if (!parsed.storage?.type) {
    throw new Error('配置缺少 storage.type');
  }

  return parsed as BackupConfig;
}

/**
 * 加载 .env 文件中的 OAuth 凭证
 */
export function loadEnv(envPath?: string): void {
  const dotenv = require('dotenv');
  const p = envPath || path.join(process.cwd(), '.env');
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}