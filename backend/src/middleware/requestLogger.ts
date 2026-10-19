import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const logFormat = env.NODE_ENV === 'production'
  ? winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  : winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.colorize({ all: true }),
      winston.format.printf(({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`.trim()
      )
    );

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: logFormat,
  transports: [new winston.transports.Console()],
});

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const msg = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    if (res.statusCode >= 400) {
      logger.error(msg, meta);
    } else {
      logger.info(msg, meta);
    }
  });
  next();
}
