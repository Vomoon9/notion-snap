/**
 * notion/types.ts — Notion API TypeScript 类型定义
 * 关键类型，用于 reader / exporter / restore
 */

export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  created_time: string;
  last_edited_time: string;
  [key: string]: any; // block type-specific data
}

export interface PageTreeNode {
  id: string;
  type: 'page' | 'database';
  title: string;
  url: string;
  lastEditedTime: string;
  icon?: any;
  children: PageTreeNode[];
}

export interface ManifestEntry {
  id: string;
  title: string;
  type: 'page' | 'database';
  hash: string;
  lastEdited: string;
  path: string;
}

export interface ManifestFailed {
  id: string;
  title: string;
  error: string;
  retryCount: number;
}

export interface Manifest {
  timestamp: string;
  stats: { success: number; failed: number; skipped: number };
  success: ManifestEntry[];
  failed: ManifestFailed[];
  previousFailedRetry?: boolean;
}