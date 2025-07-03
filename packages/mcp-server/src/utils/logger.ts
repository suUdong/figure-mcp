import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// 로그 포맷 정의
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console 포맷 (개발 환경용)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += `\n${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Transport 설정
const transports: winston.transport[] = [];

// Console transport (개발 환경)
if (nodeEnv === 'development') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: logLevel,
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: logFormat,
      level: logLevel,
    })
  );
}

// File transport (프로덕션 환경)
if (nodeEnv === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
    })
  );
}

// Winston logger 생성
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports,
  // 처리되지 않은 예외 로깅
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  // 처리되지 않은 Promise 거부 로깅
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// 개발 환경에서는 unhandled rejection/exception을 콘솔에도 출력
if (nodeEnv !== 'production') {
  logger.exceptions.handle(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
  logger.rejections.handle(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} 