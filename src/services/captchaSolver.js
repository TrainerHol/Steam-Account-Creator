const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');

class CaptchaSolver {
    constructor() {
        this.solvers = {
            simple: new SimpleCaptchaSolver(),
            brightdata: new BrightDataSolver(),
            twocaptcha: new TwoCaptchaSolver(),
            anticaptcha: new AntiCaptchaSolver()
        };
        this.fallbackOrder = ['simple', 'twocaptcha', 'anticaptcha'];
    }

    /**
     * Solve hCaptcha with fallback chain
     */
    async solvehCaptcha(email, siteKey, pageUrl, proxy = null, page = null) {
        const startTime = Date.now();
        
        for (const solverName of this.fallbackOrder) {
            const solver = this.solvers[solverName];
            
            if (!solver.isConfigured()) {
                logger.debug(`Skipping ${solverName} - not configured`);
                continue;
            }

            try {
                logger.captchaEncountered(email, `hCaptcha-${solverName}`);
                
                const solution = await solver.solvehCaptcha(siteKey, pageUrl, proxy, page);
                const duration = Date.now() - startTime;
                
                logger.captchaSolved(email, solverName, duration);
                return {
                    solution,
                    solver: solverName,
                    duration
                };
            } catch (error) {
                logger.captchaFailed(email, solverName, error);
                
                // Continue to next solver unless it's the last one
                if (solverName === this.fallbackOrder[this.fallbackOrder.length - 1]) {
                    throw new Error(`All captcha solvers failed. Last error: ${error.message}`);
                }
            }
        }

        throw new Error('No captcha solvers available');
    }

    /**
     * Detect captcha type on page
     */
    async detectCaptcha(page) {
        try {
            // Check for hCaptcha - multiple selectors
            const hCaptchaSelectors = [
                '.h-captcha',
                '[data-sitekey]',
                'iframe[src*="hcaptcha"]',
                'div[id*="captcha"]',
                'div[class*="captcha"]'
            ];
            
            for (const selector of hCaptchaSelectors) {
                const hCaptcha = await page.$(selector);
                if (hCaptcha) {
                    let siteKey = await hCaptcha.getAttribute('data-sitekey');
                    
                    // If no sitekey found, look for it in parent elements
                    if (!siteKey) {
                        const parent = await page.$('[data-sitekey]');
                        if (parent) {
                            siteKey = await parent.getAttribute('data-sitekey');
                        }
                    }
                    
                    return {
                        type: 'hcaptcha',
                        siteKey: siteKey,
                        element: hCaptcha
                    };
                }
            }

            // Check for reCAPTCHA
            const reCaptchaSelectors = [
                '.g-recaptcha',
                'iframe[src*="recaptcha"]',
                '[data-recaptcha-sitekey]'
            ];
            
            for (const selector of reCaptchaSelectors) {
                const reCaptcha = await page.$(selector);
                if (reCaptcha) {
                    let siteKey = await reCaptcha.getAttribute('data-sitekey') || 
                                  await reCaptcha.getAttribute('data-recaptcha-sitekey');
                    return {
                        type: 'recaptcha',
                        siteKey: siteKey,
                        element: reCaptcha
                    };
                }
            }

            return null;
        } catch (error) {
            logger.error('Error detecting captcha', { error: error.message });
            return null;
        }
    }

    /**
     * Auto-solve captcha on page
     */
    async autoSolveCaptcha(email, page, proxy = null) {
        const captcha = await this.detectCaptcha(page);
        
        if (!captcha) {
            return null;
        }

        const pageUrl = page.url();
        
        if (captcha.type === 'hcaptcha') {
            // Use the solver chain which includes simple click first
            const result = await this.solvehCaptcha(email, captcha.siteKey, pageUrl, proxy, page);
            
            // Inject solution into page if it's not already done
            if (result.solver !== 'simple' && result.solution !== 'checkbox_click_success') {
                await page.evaluate((token) => {
                    const textarea = document.querySelector('[name="h-captcha-response"]');
                    if (textarea) {
                        textarea.value = token;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    
                    // Trigger callback if it exists
                    if (window.hcaptchaCallback) {
                        window.hcaptchaCallback(token);
                    }
                }, result.solution);
            }
            
            return result;
        }
        
        throw new Error(`Unsupported captcha type: ${captcha.type}`);
    }

    /**
     * Try to solve hCaptcha by simply clicking the checkbox
     */
    async trySimpleHCaptchaClick(page) {
        try {
            // Look for the hCaptcha checkbox
            const checkboxSelectors = [
                '.h-captcha iframe',
                'iframe[src*="hcaptcha"]',
                '[role="checkbox"]',
                '.h-captcha'
            ];
            
            for (const selector of checkboxSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        // If it's an iframe, we need to interact with it
                        if (selector.includes('iframe')) {
                            const frame = await element.contentFrame();
                            if (frame) {
                                await frame.click('[role="checkbox"]');
                            }
                        } else {
                            await element.click();
                        }
                        
                        // Wait a moment to see if it resolves
                        await page.waitForTimeout(3000);
                        
                        // Check if the captcha was solved
                        const isSolved = await page.evaluate(() => {
                            const response = document.querySelector('[name="h-captcha-response"]');
                            return response && response.value && response.value.length > 0;
                        });
                        
                        return isSolved;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            return false;
        } catch (error) {
            logger.debug('Simple hCaptcha click failed', { error: error.message });
            return false;
        }
    }
}

/**
 * Simple Captcha Solver - tries clicking the checkbox
 */
class SimpleCaptchaSolver {
    constructor() {
        // No configuration needed
    }

    isConfigured() {
        return true; // Always available
    }

    async solvehCaptcha(siteKey, pageUrl, proxy = null, page = null) {
        if (!page) {
            throw new Error('Page object required for simple captcha solver');
        }
        
        try {
            // Look for the hCaptcha checkbox
            const checkboxSelectors = [
                '.h-captcha iframe',
                'iframe[src*="hcaptcha"]',
                '[role="checkbox"]',
                '.h-captcha'
            ];
            
            for (const selector of checkboxSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        // If it's an iframe, we need to interact with it
                        if (selector.includes('iframe')) {
                            const frame = await element.contentFrame();
                            if (frame) {
                                await frame.click('[role="checkbox"]');
                            }
                        } else {
                            await element.click();
                        }
                        
                        // Wait a moment to see if it resolves
                        await page.waitForTimeout(5000);
                        
                        // Check if the captcha was solved
                        const isSolved = await page.evaluate(() => {
                            const response = document.querySelector('[name="h-captcha-response"]');
                            return response && response.value && response.value.length > 0;
                        });
                        
                        if (isSolved) {
                            const token = await page.evaluate(() => {
                                const response = document.querySelector('[name="h-captcha-response"]');
                                return response ? response.value : null;
                            });
                            return token || 'checkbox_click_success';
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
            
            throw new Error('Could not find or click hCaptcha checkbox');
        } catch (error) {
            throw new Error(`Simple captcha solver failed: ${error.message}`);
        }
    }
}

/**
 * BrightData Captcha Solver
 */
class BrightDataSolver {
    constructor() {
        this.apiToken = config.brightdata.apiToken;
    }

    isConfigured() {
        return !!this.apiToken;
    }

    async solvehCaptcha(siteKey, pageUrl, proxy = null) {
        try {
            // BrightData doesn't have a direct captcha API endpoint
            // Their captcha solving is integrated into Web Unlocker/MCP
            // For now, we'll throw an error to fall back to other solvers
            throw new Error('BrightData direct captcha API not available - use Web Unlocker instead');
        } catch (error) {
            throw new Error(`BrightData solver failed: ${error.message}`);
        }
    }
}

/**
 * 2Captcha Solver
 */
class TwoCaptchaSolver {
    constructor() {
        this.apiKey = config.captcha.twocaptcha.apiKey;
        this.baseUrl = config.captcha.twocaptcha.baseUrl;
    }

    isConfigured() {
        return !!this.apiKey;
    }

    async solvehCaptcha(siteKey, pageUrl, proxy = null) {
        try {
            // Submit captcha task
            const submitResponse = await axios.post(`${this.baseUrl}/in.php`, {
                key: this.apiKey,
                method: 'hcaptcha',
                sitekey: siteKey,
                pageurl: pageUrl,
                proxy: proxy ? `${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}` : null,
                proxytype: proxy ? 'HTTP' : null,
                json: 1
            });

            if (submitResponse.data.status !== 1) {
                throw new Error(`2Captcha submission failed: ${submitResponse.data.error_text}`);
            }

            const taskId = submitResponse.data.request;
            
            // Poll for solution
            let attempts = 0;
            const maxAttempts = 24; // 2 minutes with 5 second intervals
            
            while (attempts < maxAttempts) {
                await this.delay(5000);
                
                const resultResponse = await axios.get(`${this.baseUrl}/res.php`, {
                    params: {
                        key: this.apiKey,
                        action: 'get',
                        id: taskId,
                        json: 1
                    }
                });

                if (resultResponse.data.status === 1) {
                    return resultResponse.data.request;
                }
                
                if (resultResponse.data.error_text && 
                    resultResponse.data.error_text !== 'CAPCHA_NOT_READY') {
                    throw new Error(`2Captcha error: ${resultResponse.data.error_text}`);
                }
                
                attempts++;
            }
            
            throw new Error('2Captcha timeout - solution not received');
        } catch (error) {
            throw new Error(`2Captcha solver failed: ${error.message}`);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Anti-Captcha Solver
 */
class AntiCaptchaSolver {
    constructor() {
        this.apiKey = config.captcha.anticaptcha.apiKey;
        this.baseUrl = config.captcha.anticaptcha.baseUrl;
    }

    isConfigured() {
        return !!this.apiKey;
    }

    async solvehCaptcha(siteKey, pageUrl, proxy = null) {
        try {
            // Create task
            const taskData = {
                type: 'HCaptchaTaskProxyless',
                websiteURL: pageUrl,
                websiteKey: siteKey
            };

            if (proxy) {
                taskData.type = 'HCaptchaTask';
                taskData.proxyType = 'http';
                taskData.proxyAddress = proxy.proxy_address;
                taskData.proxyPort = proxy.port;
                taskData.proxyLogin = proxy.username;
                taskData.proxyPassword = proxy.password;
            }

            const createResponse = await axios.post(`${this.baseUrl}/createTask`, {
                clientKey: this.apiKey,
                task: taskData
            });

            if (createResponse.data.errorId !== 0) {
                throw new Error(`Anti-Captcha task creation failed: ${createResponse.data.errorDescription}`);
            }

            const taskId = createResponse.data.taskId;
            
            // Poll for solution
            let attempts = 0;
            const maxAttempts = 24; // 2 minutes
            
            while (attempts < maxAttempts) {
                await this.delay(5000);
                
                const resultResponse = await axios.post(`${this.baseUrl}/getTaskResult`, {
                    clientKey: this.apiKey,
                    taskId: taskId
                });

                if (resultResponse.data.errorId !== 0) {
                    throw new Error(`Anti-Captcha error: ${resultResponse.data.errorDescription}`);
                }

                if (resultResponse.data.status === 'ready') {
                    return resultResponse.data.solution.gRecaptchaResponse;
                }
                
                attempts++;
            }
            
            throw new Error('Anti-Captcha timeout - solution not received');
        } catch (error) {
            throw new Error(`Anti-Captcha solver failed: ${error.message}`);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CaptchaSolver;