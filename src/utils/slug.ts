/**
 * utils/slug.ts — 文件名安全化
 * Notion 页面标题可能包含中文、特殊字符、空格
 * 转为安全的文件路径片段
 */

export function slugify(text: string): string {
  return text
    .trim()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '') // 保留字母数字中文空格连字符
    .replace(/\s+/g, '-')                   // 空格转连字符
    .replace(/-+/g, '-')                     // 多个连字符合并
    .replace(/^-|-$/g, '')                   // 去掉首尾连字符
    .slice(0, 50)                            // 限制长度
    || 'untitled';                           // 空标题兜底
}

/**
 * 生成确定性文件路径：{slug}-{pageId前8位}
 * 确定性 = 同一个页面每次备份产生相同的路径 → clean diff
 */
export function pagePath(title: string, pageId: string): string {
  return `${slugify(title)}-${pageId.replace(/-/g, '').slice(0, 8)}`;
}