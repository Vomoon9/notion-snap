/**
 * utils/logger.ts — 简单的日志工具
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

export function log(level: LogLevel, msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`${COLORS[level]}[${ts}] ${level.toUpperCase()}${RESET} ${msg}`);
}

export const logger = {
  debug: (msg: string) => log('debug', msg),
  info: (msg: string) => log('info', msg),
  warn: (msg: string) => log('warn', msg),
  error: (msg: string) => log('error', msg),
};