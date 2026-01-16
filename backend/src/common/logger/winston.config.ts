import * as winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

export const winstonConfig: winston.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    isProduction
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${context || 'Application'}] ${level}: ${message}${metaStr}`;
          }),
        ),
  ),
  transports: [new winston.transports.Console()],
  defaultMeta: {
    service: 'raffle-backend',
  },
};
