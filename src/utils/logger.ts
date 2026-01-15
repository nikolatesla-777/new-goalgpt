import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'goalgpt-dashboard' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// CRITICAL FIX: Also add Console transport in production for PM2 visibility
// Previous bug: Console only added in dev, so PM2 logs were empty
const consoleFormat = process.env.NODE_ENV === 'production'
  ? winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length && !meta.service ? JSON.stringify(meta) : ''
        }`
    )
  )
  : winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
        }`
    )
  );

logger.add(
  new winston.transports.Console({
    format: consoleFormat,
  })
);

