const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
    'WEBSHARE_API_TOKEN',
    'BRIGHTDATA_API_TOKEN'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

const config = {
    // WebShare Proxy Configuration
    webshare: {
        apiToken: process.env.WEBSHARE_API_TOKEN,
        baseUrl: 'https://proxy.webshare.io/api/v2',
        rateLimitGeneral: 180, // requests per minute
        rateLimitProxyList: 20  // requests per minute
    },

    // BrightData Configuration
    brightdata: {
        apiToken: process.env.BRIGHTDATA_API_TOKEN,
        browserZone: process.env.BRIGHTDATA_BROWSER_ZONE || 'mcp_browser',
        webUnlockerZone: process.env.WEB_UNLOCKER_ZONE || 'mcp_unlocker'
    },

    // Backup Captcha Solvers
    captcha: {
        twocaptcha: {
            apiKey: process.env.TWOCAPTCHA_API_KEY,
            baseUrl: 'https://2captcha.com'
        },
        anticaptcha: {
            apiKey: process.env.ANTICAPTCHA_API_KEY,
            baseUrl: 'https://api.anti-captcha.com'
        }
    },

    // Application Settings
    app: {
        maxConcurrentAccounts: parseInt(process.env.MAX_CONCURRENT_ACCOUNTS) || 3,
        delayRange: {
            min: parseInt(process.env.DELAY_RANGE_MIN) || 2000,
            max: parseInt(process.env.DELAY_RANGE_MAX) || 8000
        },
        proxyRotationEnabled: process.env.PROXY_ROTATION_ENABLED === 'true',
        headless: process.env.HEADLESS !== 'false',
        debug: process.env.DEBUG === 'true'
    },

    // Steam Configuration
    steam: {
        registrationUrl: 'https://store.steampowered.com/join/',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || 'logs/steam-creator.log',
        console: true
    },

    // File Paths
    paths: {
        accounts: path.join(__dirname, '../data/accounts.csv'),
        results: path.join(__dirname, '../data/results.json'),
        fingerprints: path.join(__dirname, '../data/fingerprints.json'),
        logs: path.join(__dirname, '../../logs')
    }
};

module.exports = config;