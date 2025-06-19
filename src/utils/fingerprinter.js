const fs = require('fs');
const path = require('path');
const config = require('../config/env');

/**
 * Browser fingerprint generator for stealth automation
 */
class Fingerprinter {
    constructor() {
        this.fingerprintCache = new Map();
        this.loadFingerprints();
    }

    /**
     * Load pre-generated fingerprints from file
     */
    loadFingerprints() {
        try {
            if (fs.existsSync(config.paths.fingerprints)) {
                const data = fs.readFileSync(config.paths.fingerprints, 'utf8');
                const fingerprints = JSON.parse(data);
                fingerprints.forEach(fp => {
                    this.fingerprintCache.set(fp.id, fp);
                });
            }
        } catch (error) {
            // If file doesn't exist or is invalid, we'll generate new ones
            console.log('No existing fingerprints found, will generate new ones');
        }
    }

    /**
     * Save fingerprints to file
     */
    saveFingerprints() {
        try {
            const fingerprints = Array.from(this.fingerprintCache.values());
            const dir = path.dirname(config.paths.fingerprints);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(config.paths.fingerprints, JSON.stringify(fingerprints, null, 2));
        } catch (error) {
            console.error('Failed to save fingerprints:', error);
        }
    }

    /**
     * Generate a realistic browser fingerprint
     */
    generateFingerprint(email, proxy = null) {
        const fingerprintId = `${email}_${Date.now()}`;
        
        // Base fingerprint data
        const baseFingerprints = [
            {
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                platform: 'MacIntel',
                language: 'en-US',
                languages: ['en-US', 'en'],
                timezone: 'America/New_York',
                screen: { width: 1440, height: 900 },
                viewport: { width: 1440, height: 789 }
            },
            {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                platform: 'Win32',
                language: 'en-US',
                languages: ['en-US', 'en'],
                timezone: 'America/Chicago',
                screen: { width: 1920, height: 1080 },
                viewport: { width: 1920, height: 969 }
            },
            {
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                platform: 'Linux x86_64',
                language: 'en-US',
                languages: ['en-US', 'en'],
                timezone: 'America/Los_Angeles',
                screen: { width: 1366, height: 768 },
                viewport: { width: 1366, height: 657 }
            }
        ];

        // Select random base fingerprint
        const baseFingerprint = baseFingerprints[Math.floor(Math.random() * baseFingerprints.length)];
        
        // Adjust fingerprint based on proxy location if available
        if (proxy && proxy.country_code) {
            this.adjustFingerprintForLocation(baseFingerprint, proxy.country_code);
        }

        const fingerprint = {
            id: fingerprintId,
            email: email,
            userAgent: baseFingerprint.userAgent,
            viewport: baseFingerprint.viewport,
            screen: baseFingerprint.screen,
            deviceScaleFactor: Math.random() > 0.5 ? 1 : 2,
            isMobile: false,
            hasTouch: false,
            colorScheme: 'light',
            reducedMotion: 'no-preference',
            forcedColors: 'none',
            locale: baseFingerprint.language,
            timezoneId: baseFingerprint.timezone,
            extraHTTPHeaders: {
                'Accept-Language': `${baseFingerprint.language},en;q=0.9`,
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Cache-Control': 'max-age=0',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            },
            webgl: {
                vendor: this.getRandomWebGLVendor(),
                renderer: this.getRandomWebGLRenderer()
            },
            created: new Date().toISOString()
        };

        this.fingerprintCache.set(fingerprintId, fingerprint);
        this.saveFingerprints();
        
        return fingerprint;
    }

    /**
     * Adjust fingerprint based on proxy location
     */
    adjustFingerprintForLocation(fingerprint, countryCode) {
        const locationMappings = {
            'US': {
                language: 'en-US',
                languages: ['en-US', 'en'],
                timezone: 'America/New_York'
            },
            'GB': {
                language: 'en-GB',
                languages: ['en-GB', 'en'],
                timezone: 'Europe/London'
            },
            'CA': {
                language: 'en-CA',
                languages: ['en-CA', 'en', 'fr'],
                timezone: 'America/Toronto'
            },
            'AU': {
                language: 'en-AU',
                languages: ['en-AU', 'en'],
                timezone: 'Australia/Sydney'
            },
            'DE': {
                language: 'de-DE',
                languages: ['de-DE', 'de', 'en'],
                timezone: 'Europe/Berlin'
            },
            'FR': {
                language: 'fr-FR',
                languages: ['fr-FR', 'fr', 'en'],
                timezone: 'Europe/Paris'
            }
        };

        const mapping = locationMappings[countryCode.toUpperCase()];
        if (mapping) {
            fingerprint.language = mapping.language;
            fingerprint.languages = mapping.languages;
            fingerprint.timezone = mapping.timezone;
        }
    }

    /**
     * Get random WebGL vendor to avoid bot detection
     */
    getRandomWebGLVendor() {
        const vendors = [
            'Google Inc.',
            'Google Inc. (Intel)',
            'Google Inc. (NVIDIA)',
            'Google Inc. (AMD)',
            'Mozilla',
            'WebKit'
        ];
        return vendors[Math.floor(Math.random() * vendors.length)];
    }

    /**
     * Get random WebGL renderer to avoid bot detection
     */
    getRandomWebGLRenderer() {
        const renderers = [
            'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)',
            'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060, OpenGL 4.1)',
            'ANGLE (AMD, AMD Radeon RX 580, OpenGL 4.1)',
            'Intel(R) UHD Graphics 630',
            'NVIDIA GeForce GTX 1060',
            'AMD Radeon RX 580',
            'Apple GPU'
        ];
        return renderers[Math.floor(Math.random() * renderers.length)];
    }

    /**
     * Get existing fingerprint for email or create new one
     */
    getFingerprintForEmail(email, proxy = null) {
        // Look for existing fingerprint
        const existing = Array.from(this.fingerprintCache.values())
            .find(fp => fp.email === email);
        
        if (existing) {
            return existing;
        }

        // Generate new fingerprint
        return this.generateFingerprint(email, proxy);
    }

    /**
     * Apply fingerprint to Playwright browser context
     */
    async applyFingerprint(context, fingerprint) {
        try {
            // Note: Viewport is set during context creation, not here

            // Set extra HTTP headers
            await context.setExtraHTTPHeaders(fingerprint.extraHTTPHeaders);

            // Set geolocation if available
            if (fingerprint.geolocation) {
                await context.setGeolocation(fingerprint.geolocation);
            }

            // Override navigator properties via script
            await context.addInitScript(`
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                Object.defineProperty(navigator, 'languages', {
                    get: () => ${JSON.stringify(fingerprint.locale.split(','))},
                });
                
                Object.defineProperty(navigator, 'language', {
                    get: () => '${fingerprint.locale}',
                });
                
                Object.defineProperty(navigator, 'platform', {
                    get: () => '${fingerprint.platform || 'Win32'}',
                });
                
                // Override WebGL properties
                const getParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) {
                        return '${fingerprint.webgl.vendor}';
                    }
                    if (parameter === 37446) {
                        return '${fingerprint.webgl.renderer}';
                    }
                    return getParameter.call(this, parameter);
                };
                
                // Override screen properties
                Object.defineProperty(screen, 'width', {
                    get: () => ${fingerprint.screen.width},
                });
                Object.defineProperty(screen, 'height', {
                    get: () => ${fingerprint.screen.height},
                });
                Object.defineProperty(screen, 'availWidth', {
                    get: () => ${fingerprint.screen.width},
                });
                Object.defineProperty(screen, 'availHeight', {
                    get: () => ${fingerprint.screen.height - 30},
                });
            `);

        } catch (error) {
            console.error('Failed to apply fingerprint:', error);
        }
    }

    /**
     * Clean up old fingerprints
     */
    cleanupOldFingerprints(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
        const cutoff = Date.now() - maxAge;
        let cleaned = 0;
        
        for (const [id, fingerprint] of this.fingerprintCache.entries()) {
            if (new Date(fingerprint.created).getTime() < cutoff) {
                this.fingerprintCache.delete(id);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            this.saveFingerprints();
            console.log(`Cleaned up ${cleaned} old fingerprints`);
        }
    }
}

module.exports = Fingerprinter;