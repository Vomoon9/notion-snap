/**
 * storage/local.ts — 本地文件存储
 */

import * as fs from 'fs';
import * as path from 'path';

export class LocalStorage {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
  }

  async write(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.basePath, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  async writeJson(relativePath: string, data: any): Promise<void> {
    await this.write(relativePath, JSON.stringify(data, null, 2));
  }

  async finalize(_message: string): Promise<void> {}

  async read(relativePath: string): Promise<string | null> {
    const fullPath = path.join(this.basePath, relativePath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath, 'utf8');
  }
}