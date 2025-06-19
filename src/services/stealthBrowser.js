const { chromium } = require('playwright');
const logger = require('../utils/logger');
const config = require('../config/env');
const Fingerprinter = require('../utils/fingerprinter');

class StealthBrowser {
    constructor() {
        this.browser = null;
        this.contexts = new Map(); // email -> context mapping
        this.fingerprinter = new Fingerprinter();
    }

    /**
     * Launch the browser with stealth configuration
     */
    async launch() {
        if (this.browser) {
            return this.browser;
        }

        try {
            this.browser = await chromium.launch({
                headless: config.app.headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-features=TranslateUI',
                    '--disable-ipc-flooding-protection',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-extensions',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--no-pings',
                    '--password-store=basic',
                    '--use-mock-keychain',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-default-apps',
                    '--mute-audio',
                    '--disable-background-media-downloads',
                    '--disable-device-discovery-notifications'
                ],
                ignoreDefaultArgs: ['--enable-automation'],
                slowMo: config.app.debug ? 100 : 0
            });

            logger.info('Stealth browser launched successfully');
            return this.browser;
        } catch (error) {
            logger.error('Failed to launch browser', { error: error.message });
            throw error;
        }
    }

    /**
     * Create a new browser context with stealth configuration
     */
    async createContext(email, proxy = null) {
        if (!this.browser) {
            await this.launch();
        }

        // Check if context already exists
        if (this.contexts.has(email)) {
            return this.contexts.get(email);
        }

        try {
            // Generate fingerprint for this email/proxy combination
            const fingerprint = this.fingerprinter.getFingerprintForEmail(email, proxy);
            
            // Context options
            const contextOptions = {
                userAgent: fingerprint.userAgent,
                viewport: fingerprint.viewport,
                deviceScaleFactor: fingerprint.deviceScaleFactor,
                isMobile: fingerprint.isMobile,
                hasTouch: fingerprint.hasTouch,
                colorScheme: fingerprint.colorScheme,
                reducedMotion: fingerprint.reducedMotion,
                forcedColors: fingerprint.forcedColors,
                locale: fingerprint.locale,
                timezoneId: fingerprint.timezoneId,
                extraHTTPHeaders: fingerprint.extraHTTPHeaders,
                ignoreHTTPSErrors: true,
                acceptDownloads: false,
                javaScriptEnabled: true,
                bypassCSP: true
            };

            // Add proxy configuration if available
            if (proxy) {
                const proxyConfig = this.formatProxyForContext(proxy);
                if (proxyConfig) {
                    contextOptions.proxy = proxyConfig;
                }
            }

            // Create context
            const context = await this.browser.newContext(contextOptions);
            
            // Apply fingerprint overrides
            await this.fingerprinter.applyFingerprint(context, fingerprint);
            
            // Add additional stealth measures
            await this.addStealthMeasures(context);
            
            // Store context
            this.contexts.set(email, context);
            
            logger.info('Browser context created', { 
                email, 
                proxy: proxy ? `${proxy.proxy_address}:${proxy.port}` : 'none',
                userAgent: fingerprint.userAgent.substring(0, 50) + '...'
            });

            return context;
        } catch (error) {
            logger.error('Failed to create browser context', { 
                email, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Format proxy for Playwright context
     */
    formatProxyForContext(proxy) {
        if (!proxy) return null;
        
        return {
            server: `http://${proxy.proxy_address}:${proxy.port}`,
            username: proxy.username,
            password: proxy.password
        };
    }

    /**
     * Add additional stealth measures to context
     */
    async addStealthMeasures(context) {
        // Comprehensive stealth script
        await context.addInitScript(() => {
            // Remove webdriver property completely
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
                configurable: true
            });
            
            // Remove automation flags
            delete navigator.__proto__.webdriver;
            
            // Override plugins with realistic list
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {
                        name: 'Chrome PDF Plugin',
                        filename: 'internal-pdf-viewer',
                        description: 'Portable Document Format',
                        length: 1,
                        0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' }
                    },
                    {
                        name: 'Chrome PDF Viewer',
                        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                        description: '',
                        length: 1,
                        0: { type: 'application/pdf', suffixes: 'pdf', description: '' }
                    },
                    {
                        name: 'Native Client',
                        filename: 'internal-nacl-plugin',
                        description: '',
                        length: 2,
                        0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
                        1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' }
                    }
                ]
            });

            // Override languages to be more realistic
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // Override permissions API
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Override chrome object completely
            if (!window.chrome) {
                window.chrome = {};
            }
            
            window.chrome.runtime = {
                onConnect: {
                    addListener: () => {},
                    removeListener: () => {},
                    hasListener: () => false
                },
                onMessage: {
                    addListener: () => {},
                    removeListener: () => {},
                    hasListener: () => false
                },
                sendMessage: () => {},
                connect: () => ({
                    postMessage: () => {},
                    disconnect: () => {},
                    onMessage: { addListener: () => {}, removeListener: () => {} }
                })
            };

            // Override WebGL to avoid detection
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel(R) Iris(TM) Graphics 6100';
                }
                return getParameter.call(this, parameter);
            };

            // Hide automation in toString
            const originalToString = Function.prototype.toString;
            Function.prototype.toString = function() {
                if (this === navigator.webdriver) {
                    return 'function webdriver() { [native code] }';
                }
                return originalToString.call(this);
            };

            // Override screen properties to be consistent
            Object.defineProperties(screen, {
                availTop: { get: () => 0 },
                availLeft: { get: () => 0 },
                availWidth: { get: () => screen.width },
                availHeight: { get: () => screen.height - 30 },
                colorDepth: { get: () => 24 },
                pixelDepth: { get: () => 24 }
            });

            // Mock notification permission
            Object.defineProperty(Notification, 'permission', {
                get: () => 'default'
            });

            // Remove automation console logs
            const originalLog = console.log;
            const originalDebug = console.debug;
            const originalInfo = console.info;
            
            console.log = (...args) => {
                if (!args.some(arg => 
                    typeof arg === 'string' && 
                    (arg.includes('playwright') || arg.includes('automation') || arg.includes('webdriver'))
                )) {
                    originalLog.apply(console, args);
                }
            };
            
            console.debug = (...args) => {
                if (!args.some(arg => 
                    typeof arg === 'string' && 
                    (arg.includes('playwright') || arg.includes('automation') || arg.includes('webdriver'))
                )) {
                    originalDebug.apply(console, args);
                }
            };

            // Hide devtools detection
            let devtools = {
                open: false,
                orientation: null
            };
            
            const threshold = 160;
            setInterval(() => {
                if (window.outerHeight - window.innerHeight > threshold || 
                    window.outerWidth - window.innerWidth > threshold) {
                    if (!devtools.open) {
                        devtools.open = true;
                        devtools.orientation = window.outerHeight - window.innerHeight > threshold ? 'vertical' : 'horizontal';
                    }
                } else {
                    if (devtools.open) {
                        devtools.open = false;
                        devtools.orientation = null;
                    }
                }
            }, 500);

            // Override Date to avoid timezone detection
            const originalDate = Date;
            Date = function(...args) {
                if (args.length === 0) {
                    return new originalDate();
                }
                return new originalDate(...args);
            };
            Date.prototype = originalDate.prototype;
            Date.now = originalDate.now;
            Date.parse = originalDate.parse;
            Date.UTC = originalDate.UTC;
        });

        // Set realistic cookie preferences
        await context.addCookies([
            {
                name: 'cookieSettings',
                value: 'essential%3Dtrue%26analytics%3Dtrue%26marketing%3Dfalse',
                domain: '.steampowered.com',
                path: '/',
                httpOnly: false,
                secure: true,
                sameSite: 'Lax'
            }
        ]);
    }

    /**
     * Create a new page with human-like behavior
     */
    async createPage(email) {
        const context = await this.getContext(email);
        const page = await context.newPage();
        
        // Add human-like mouse movement
        await this.addHumanBehavior(page);
        
        return page;
    }

    /**
     * Add human-like behavior to page
     */
    async addHumanBehavior(page) {
        // Override mouse movements to be more human-like
        const originalClick = page.click;
        page.click = async (selector, options = {}) => {
            // Add small random delay before click
            await this.randomDelay(50, 200);
            
            // Move mouse to element first
            try {
                await page.hover(selector);
                await this.randomDelay(100, 300);
            } catch (e) {
                // If hover fails, proceed with click
            }
            
            return originalClick.call(page, selector, options);
        };

        // Override typing to be more human-like
        const originalType = page.type;
        page.type = async (selector, text, options = {}) => {
            const delay = options.delay || this.getRandomTypingDelay();
            return originalType.call(page, selector, text, { ...options, delay });
        };

        // Add page event listeners for more realistic behavior
        page.on('response', response => {
            logger.debug('Page response', { 
                url: response.url(),
                status: response.status()
            });
        });
    }

    /**
     * Get existing context for email
     */
    async getContext(email) {
        if (!this.contexts.has(email)) {
            throw new Error(`No context found for email: ${email}`);
        }
        return this.contexts.get(email);
    }

    /**
     * Close context for specific email
     */
    async closeContext(email) {
        if (this.contexts.has(email)) {
            const context = this.contexts.get(email);
            await context.close();
            this.contexts.delete(email);
            logger.debug('Browser context closed', { email });
        }
    }

    /**
     * Close all contexts and browser
     */
    async close() {
        // Close all contexts
        for (const [email, context] of this.contexts.entries()) {
            try {
                await context.close();
            } catch (error) {
                logger.warn('Error closing context', { email, error: error.message });
            }
        }
        this.contexts.clear();

        // Close browser
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            logger.info('Browser closed');
        }
    }

    /**
     * Random delay utility
     */
    async randomDelay(min = 1000, max = 3000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Get random typing delay for human-like behavior
     */
    getRandomTypingDelay() {
        return Math.floor(Math.random() * 100) + 50; // 50-150ms
    }

    /**
     * Simulate human-like page scrolling
     */
    async humanScroll(page, direction = 'down', distance = 300) {
        const scrollSteps = Math.floor(distance / 50);
        const stepDistance = distance / scrollSteps;
        
        for (let i = 0; i < scrollSteps; i++) {
            await page.evaluate((step, dir) => {
                window.scrollBy(0, dir === 'down' ? step : -step);
            }, stepDistance, direction);
            
            await this.randomDelay(50, 150);
        }
    }

    /**
     * Get browser statistics
     */
    getStats() {
        return {
            isLaunched: !!this.browser,
            activeContexts: this.contexts.size,
            contexts: Array.from(this.contexts.keys())
        };
    }
}

module.exports = StealthBrowser;