// ═══════════════════════════════════════════════════════════════
// CrikeX Logger — Production-grade structured logging
// ═══════════════════════════════════════════════════════════════

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LEVELS[process.env.LOG_LEVEL || 'debug'];
const IS_PROD = process.env.NODE_ENV === 'production';

function formatLog(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'crikex-api',
    message,
    ...meta,
  };

  if (IS_PROD) return JSON.stringify(entry);

  const colors = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' };
  const reset = '\x1b[0m';
  const color = colors[level] || reset;
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${color}[${entry.timestamp.slice(11, 23)}] ${level.toUpperCase().padEnd(5)}${reset} ${message}${metaStr}`;
}

function shouldLog(level) {
  return LEVELS[level] <= CURRENT_LEVEL;
}

export const logger = {
  error(message, meta) { if (shouldLog('error')) console.error(formatLog('error', message, meta)); },
  warn(message, meta) { if (shouldLog('warn')) console.warn(formatLog('warn', message, meta)); },
  info(message, meta) { if (shouldLog('info')) console.info(formatLog('info', message, meta)); },
  debug(message, meta) { if (shouldLog('debug')) console.debug(formatLog('debug', message, meta)); },

  // Request logging
  request(req, res, duration) {
    const meta = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id,
    };
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    this[level](`${req.method} ${req.path} ${res.statusCode}`, meta);
  },

  // Audit log for compliance
  audit(action, userId, details = {}) {
    this.info(`AUDIT: ${action}`, { userId, audit: true, ...details });
  },

  // Security events
  security(event, details = {}) {
    this.warn(`SECURITY: ${event}`, { security: true, ...details });
  },
};

// Express middleware for request logging
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => logger.request(req, res, Date.now() - start));
  next();
}

export default logger;
