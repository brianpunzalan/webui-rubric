/**
 * Leveled logger that writes exclusively to stderr.
 *
 * FR-002 requires stdout to be reserved for JSON output. All diagnostic
 * and status messages go through this logger to stderr only.
 *
 * @module logger
 */

/** Supported log levels in order of increasing severity. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Numeric priority for each log level. Higher number = more severe. */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Internal state for the singleton logger. */
let currentLevel: LogLevel = 'info';
let quietMode = false;

/**
 * Set the minimum log level. Messages below this severity are suppressed.
 *
 * @param level - The minimum log level to display.
 *
 * @example
 * ```typescript
 * setLogLevel('debug'); // Show all messages including debug
 * setLogLevel('warn');  // Only show warn and error
 * ```
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Enable or disable quiet mode. When quiet mode is on, all messages
 * below error severity are suppressed regardless of the configured log level.
 *
 * @param quiet - Whether to enable quiet mode.
 *
 * @example
 * ```typescript
 * setQuiet(true);  // Only error messages will be displayed
 * setQuiet(false); // Resume normal log level filtering
 * ```
 */
export function setQuiet(quiet: boolean): void {
  quietMode = quiet;
}

/**
 * Determine whether a message at the given level should be emitted,
 * accounting for both the configured minimum level and quiet mode.
 */
function shouldLog(level: LogLevel): boolean {
  if (quietMode && level !== 'error') {
    return false;
  }
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

/**
 * Format a log line as `[TIMESTAMP] [LEVEL] message`.
 *
 * @param level - The log level label (uppercased in output).
 * @param msg - The message to include.
 * @returns The formatted log line with a trailing newline.
 */
function formatLine(level: LogLevel, msg: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${msg}\n`;
}

/**
 * Write a formatted log line to stderr if the level passes filtering.
 *
 * Uses `process.stderr.write` directly — not `console.log` or
 * `console.error` — to guarantee output never leaks to stdout.
 */
function log(level: LogLevel, msg: string): void {
  if (!shouldLog(level)) {
    return;
  }
  process.stderr.write(formatLine(level, msg));
}

/**
 * Singleton logger instance with methods for each log level.
 *
 * All output is written to stderr via `process.stderr.write`.
 *
 * @example
 * ```typescript
 * import { logger, setLogLevel } from '@webui-rubric/core';
 *
 * setLogLevel('debug');
 * logger.info('Starting evaluation');
 * logger.debug('Loaded 42 sub-criteria');
 * logger.warn('Tool version drift detected');
 * logger.error('Schema validation failed');
 * ```
 */
export const logger = {
  /**
   * Log a debug-level message. Lowest severity; useful for development
   * and detailed diagnostic output.
   *
   * @param msg - The message to log.
   */
  debug(msg: string): void {
    log('debug', msg);
  },

  /**
   * Log an info-level message. General operational information about
   * evaluation progress.
   *
   * @param msg - The message to log.
   */
  info(msg: string): void {
    log('info', msg);
  },

  /**
   * Log a warn-level message. Indicates a potential issue that does not
   * prevent evaluation from completing (e.g., tool version drift).
   *
   * @param msg - The message to log.
   */
  warn(msg: string): void {
    log('warn', msg);
  },

  /**
   * Log an error-level message. Highest severity; indicates a failure
   * that likely prevents successful evaluation.
   *
   * @param msg - The message to log.
   */
  error(msg: string): void {
    log('error', msg);
  },
} as const;
