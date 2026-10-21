const fs = require('fs');
const path = require('path');
const winston = require('winston');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf((info) => {
          const rid = info.requestId ? ` rid=${info.requestId}` : '';
          const msg = info.message || '';
          return `${info.timestamp} ${info.level}:${rid} ${msg}`;
        })
      )
    }),
    new winston.transports.File({ filename: path.join(logDir, 'app.log') })
  ]
});

function requestLogFields(req, res) {
  return {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    status: res.statusCode,
    userAgent: req.headers['user-agent']
  };
}

module.exports = { logger, requestLogFields };
