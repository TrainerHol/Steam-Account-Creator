const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

// Ensure logs directory exists
const logsDir = config.paths.logs;
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}] ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    transports: [
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    ]
});

// Add console transport for development
if (config.logging.console) {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

// Convenience methods for specific use cases
const steamLogger = logger;

// Add custom methods
steamLogger.accountStart = (email, proxy) => {
    logger.info('Starting account creation', { 
        email, 
        proxy: proxy ? `${proxy.host}:${proxy.port}` : 'none',
        timestamp: new Date().toISOString()
    });
};

steamLogger.accountSuccess = (email, details = {}) => {
    logger.info('Account created successfully', { 
        email, 
        ...details,
        timestamp: new Date().toISOString()
    });
};

steamLogger.accountFailure = (email, error, details = {}) => {
    logger.error('Account creation failed', { 
        email, 
        error: error.message,
        stack: error.stack,
        ...details,
        timestamp: new Date().toISOString()
    });
};

// Proxy related logging
steamLogger.proxyAssigned = (email, proxy) => {
    logger.debug('Proxy assigned', { 
        email, 
        proxy: `${proxy.proxy_address}:${proxy.port}`,
        country: proxy.country_code 
    });
};

steamLogger.proxyFailed = (proxy, error) => {
    logger.warn('Proxy failed', { 
        proxy: `${proxy.proxy_address}:${proxy.port}`,
        error: error.message 
    });
};

// Captcha related logging
steamLogger.captchaEncountered = (email, type) => {
    logger.info('Captcha encountered', { email, type });
};

steamLogger.captchaSolved = (email, solver, duration) => {
    logger.info('Captcha solved', { email, solver, duration });
};

steamLogger.captchaFailed = (email, solver, error) => {
    logger.error('Captcha solving failed', { 
        email, 
        solver, 
        error: error.message 
    });
};

// Rate limiting
steamLogger.rateLimitHit = (service, resetTime) => {
    logger.warn('Rate limit hit', { service, resetTime });
};

// Browser automation
steamLogger.browserAction = (email, action, details = {}) => {
    logger.debug('Browser action', { email, action, ...details });
};

module.exports = steamLogger;