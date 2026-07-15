/**
 * storage/git.ts — Git 仓库存储
 * clone → write → commit → push
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import simpleGit from 'simple-git';

export class GitStorage {
  private repoUrl: string;
  private branch: string;
  private workDir: string;
  private git: any;

  constructor(repoUrl: string, branch: string = 'main') {
    this.repoUrl = repoUrl;
    this.branch = branch;
    // 使用临时目录
    this.workDir = path.join(os.tmpdir(), 'notion-snap-git-' + Date.now());
  }

  /**
   * 初始化：克隆仓库到临时目录
   */
  async init(): Promise<void> {
    if (fs.existsSync(this.workDir)) {
      fs.rmSync(this.workDir, { recursive: true });
    }
    fs.mkdirSync(this.workDir, { recursive: true });

    this.git = simpleGit();

    // 如果仓库非空，克隆；否则 init 新仓库
    try {
      await this.git.clone(this.repoUrl, this.workDir);
      await this.git.cwd(this.workDir);
      await this.git.checkout(this.branch);
    } catch {
      // 仓库可能是空的，init 新的
      this.git = simpleGit(this.workDir);
      await this.git.init();
      await this.git.addRemote('origin', this.repoUrl);
      // 尝试拉取
      try {
        await this.git.pull('origin', this.branch, { '--allow-unrelated-histories': null });
      } catch {
        // 空仓库，继续
      }
    }
  }

  async write(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.workDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  async writeJson(relativePath: string, data: any): Promise<void> {
    await this.write(relativePath, JSON.stringify(data, null, 2));
  }

  async read(relativePath: string): Promise<string | null> {
    const fullPath = path.join(this.workDir, relativePath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath, 'utf8');
  }

  /**
   * 完成写入：git add → commit → push
   * 如果没有变化，跳过 commit
   */
  async finalize(message: string): Promise<void> {
    if (!this.git) throw new Error('GitStorage 未初始化，请先调用 init()');

    await this.git.add('.');

    // 检查是否有变化
    const status = await this.git.status();
    if (status.staged.length === 0) {
      console.log('📝 没有变化，跳过 commit');
      return;
    }

    await this.git.commit(message);
    await this.git.push('origin', this.branch);
    console.log(`✅ 已推送到 ${this.repoUrl} (${this.branch})`);
  }

  /**
   * 清理临时目录
   */
  async cleanup(): Promise<void> {
    if (fs.existsSync(this.workDir)) {
      fs.rmSync(this.workDir, { recursive: true });
    }
  }
}