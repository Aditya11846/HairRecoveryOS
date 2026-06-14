const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LEVEL = __DEV__ ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

export const logger = {
  debug: (tag, msg, data) => {
    if (CURRENT_LEVEL <= 0) console.log(`[${tag}] ${msg}`, data ?? '');
  },
  info: (tag, msg, data) => {
    if (CURRENT_LEVEL <= 1) console.log(`[${tag}] ℹ ${msg}`, data ?? '');
  },
  warn: (tag, msg, data) => {
    if (CURRENT_LEVEL <= 2) console.warn(`[${tag}] ⚠ ${msg}`, data ?? '');
  },
  error: (tag, msg, data) => {
    if (CURRENT_LEVEL <= 3) console.error(`[${tag}] ✖ ${msg}`, data ?? '');
  },
};
