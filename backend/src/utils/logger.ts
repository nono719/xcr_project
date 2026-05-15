import path from 'path';
import fs from 'fs';
import winston from 'winston';
import { env } from '../config/env';

if (!fs.existsSync(env.log.dir)) {
  fs.mkdirSync(env.log.dir, { recursive: true });
}

const dailyFile = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return path.join(env.log.dir, `app-${ymd}.log`);
};

export const logger = winston.createLogger({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const m = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level} ${message}${m}`;
        }),
      ),
    }),
    new winston.transports.File({ filename: dailyFile() }),
  ],
});

export function logOperation(action: string, userId: number | null, detail: Record<string, unknown> = {}) {
  logger.info('operation', { action, userId, ...detail });
}
