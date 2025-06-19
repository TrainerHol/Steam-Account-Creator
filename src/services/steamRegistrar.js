const logger = require('../utils/logger');
const config = require('../config/env');
const { steamSelectors, steamConfig } = require('../config/steam-selectors');
const Humanizer = require('../utils/humanizer');
const CaptchaSolver = require('./captchaSolver');

class SteamRegistrar {
    constructor(stealthBrowser, proxyManager) {
        this.browser = stealthBrowser;
        this.proxyManager = proxyManager;
        this.humanizer = new Humanizer();
        this.captchaSolver = new CaptchaSolver();
    }

    /**
     * Register a Steam account
     */
    async registerAccount(email, password, country = null) {
        let proxy = null;
        let page = null;
        
        try {
            logger.accountStart(email);
            
            // Get proxy for this account
            proxy = await this.proxyManager.getProxyForAccount(email);
            logger.proxyAssigned(email, proxy);
            
            // Create browser context with proxy
            await this.browser.createContext(email, proxy);
            
            // Create page
            page = await this.browser.createPage(email);
            
            // Navigate to Steam registration page
            await this.navigateToRegistration(page, email);
            
            // Fill registration form
            await this.fillRegistrationForm(page, email, password, country);
            
            // Handle captcha if present
            await this.handleCaptcha(page, email, proxy);
            
            // Submit form
            const result = await this.submitForm(page, email);
            
            logger.accountSuccess(email, result);
            return result;
            
        } catch (error) {
            logger.accountFailure(email, error, { proxy });
            
            // Try with different proxy if proxy-related error
            if (this.isProxyError(error) && proxy) {
                try {
                    const newProxy = await this.proxyManager.markProxyFailed(email, proxy, error);
                    logger.info('Retrying with new proxy', { email, newProxy });
                    return await this.registerAccount(email, password, country);
                } catch (retryError) {
                    throw retryError;
                }
            }
            
            throw error;
        } finally {
            // Clean up
            if (page) {
                try {
                    await page.close();
                } catch (e) {
                    logger.warn('Error closing page', { email, error: e.message });
                }
            }
        }
    }

    /**
     * Navigate to Steam registration page
     */
    async navigateToRegistration(page, email) {
        logger.browserAction(email, 'navigate', { url: config.steam.registrationUrl });
        
        await this.humanizer.humanNavigate(page, config.steam.registrationUrl, {
            waitForLoad: true,
            readingTime: true
        });
        
        // Wait for form to be ready
        await this.humanizer.waitForInteractable(page, steamSelectors.emailInput, steamConfig.timeouts.pageLoad);
        
        // Simulate reading the page
        await this.humanizer.simulateReading(page, 1);
    }

    /**
     * Fill the Steam registration form
     */
    async fillRegistrationForm(page, email, password, country) {
        logger.browserAction(email, 'fill_form');
        
        // Fill email field
        await this.fillEmailField(page, email);
        
        // Fill confirm email field
        await this.fillConfirmEmailField(page, email);
        
        // Select country
        await this.selectCountry(page, email, country);
        
        // Check age confirmation
        await this.confirmAge(page, email);
        
        // Add realistic pause before proceeding
        await this.humanizer.humanPause('thinking');
    }

    /**
     * Fill email field with human-like behavior
     */
    async fillEmailField(page, email) {
        const selectors = [steamSelectors.emailInput, steamSelectors.emailInputAlt];
        
        for (const selector of selectors) {
            try {
                await this.humanizer.waitForInteractable(page, selector, 5000);
                await this.humanizer.fillFormField(page, selector, email, {
                    errorProbability: 0.01, // Very low error rate for email
                    minDelay: 80,
                    maxDelay: 180
                });
                logger.browserAction(email, 'email_filled');
                return;
            } catch (error) {
                continue;
            }
        }
        
        throw new Error('Could not find email input field');
    }

    /**
     * Fill confirm email field
     */
    async fillConfirmEmailField(page, email) {
        const selectors = [steamSelectors.confirmEmailInput, steamSelectors.confirmEmailInputAlt];
        
        for (const selector of selectors) {
            try {
                await this.humanizer.waitForInteractable(page, selector, 5000);
                await this.humanizer.fillFormField(page, selector, email, {
                    errorProbability: 0.005, // Even lower error rate for confirmation
                    minDelay: 70,
                    maxDelay: 160
                });
                logger.browserAction(email, 'confirm_email_filled');
                return;
            } catch (error) {
                continue;
            }
        }
        
        throw new Error('Could not find confirm email input field');
    }

    /**
     * Select country from dropdown
     */
    async selectCountry(page, email, country) {
        // Use provided country or select random one
        const selectedCountry = country || this.getRandomCountry();
        
        const selectors = [
            steamSelectors.countrySelect, 
            steamSelectors.countrySelectAlt,
            'select[name="country"]',
            'select',
            'combobox'
        ];
        
        for (const selector of selectors) {
            try {
                await this.humanizer.waitForInteractable(page, selector, 5000);
                
                // Set country via JavaScript to avoid dropdown interaction issues
                await page.evaluate(({ selector, country }) => {
                    const selectElement = document.querySelector(selector);
                    if (selectElement) {
                        // Find option by text content
                        const options = Array.from(selectElement.options);
                        const targetOption = options.find(option => 
                            option.text.includes(country) || 
                            option.value.includes(country) ||
                            option.text === country
                        );
                        
                        if (targetOption) {
                            selectElement.value = targetOption.value;
                            // Trigger change event
                            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                            selectElement.dispatchEvent(new Event('input', { bubbles: true }));
                            return true;
                        }
                        
                        // Fallback: set to first US/Canada option
                        const fallbackOption = options.find(option => 
                            option.text.includes('United States') || 
                            option.text.includes('Canada')
                        );
                        if (fallbackOption) {
                            selectElement.value = fallbackOption.value;
                            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                            selectElement.dispatchEvent(new Event('input', { bubbles: true }));
                            return true;
                        }
                    }
                    return false;
                }, { selector, country: selectedCountry });
                
                await this.humanizer.delay(this.humanizer.randomDelay(500, 1000));
                logger.browserAction(email, 'country_selected', { country: selectedCountry });
                return;
                
            } catch (error) {
                logger.debug('Country selector failed', { selector, error: error.message });
                continue;
            }
        }
        
        throw new Error('Could not find country select field');
    }

    /**
     * Confirm age checkbox
     */
    async confirmAge(page, email) {
        const selectors = [
            steamSelectors.ageCheckbox, 
            steamSelectors.ageCheckboxAlt,
            'input[type="checkbox"]',
            '[type="checkbox"]',
            'checkbox'
        ];
        
        for (const selector of selectors) {
            try {
                await this.humanizer.waitForInteractable(page, selector, 5000);
                await this.humanizer.handleCheckbox(page, selector, true);
                logger.browserAction(email, 'age_confirmed');
                return;
            } catch (error) {
                logger.debug('Age checkbox selector failed', { selector, error: error.message });
                continue;
            }
        }
        
        throw new Error('Could not find age confirmation checkbox');
    }

    /**
     * Handle captcha if present
     */
    async handleCaptcha(page, email, proxy) {
        try {
            // Wait a moment for captcha to potentially appear
            await this.humanizer.delay(2000);
            
            const captchaResult = await this.captchaSolver.autoSolveCaptcha(email, page, proxy);
            
            if (captchaResult) {
                logger.browserAction(email, 'captcha_solved', { 
                    solver: captchaResult.solver,
                    duration: captchaResult.duration 
                });
                
                // Wait for captcha solution to be processed
                await this.humanizer.delay(1000);
            }
            
        } catch (error) {
            logger.warn('Captcha handling failed', { email, error: error.message });
            // Don't throw here - captcha might not be required
        }
    }

    /**
     * Submit the registration form
     */
    async submitForm(page, email) {
        logger.browserAction(email, 'submit_form');
        
        const selectors = [
            steamSelectors.continueButton, 
            steamSelectors.continueButtonAlt,
            'button:has-text("Continue")',
            'input[type="submit"]',
            'button[type="submit"]',
            'button',
            '[type="submit"]'
        ];
        
        for (const selector of selectors) {
            try {
                await this.humanizer.waitForInteractable(page, selector, 5000);
                
                // Check if button is visible and enabled
                const isVisible = await page.isVisible(selector);
                const isEnabled = await page.isEnabled(selector);
                
                if (!isVisible || !isEnabled) {
                    logger.debug('Submit button not ready', { 
                        selector, 
                        visible: isVisible, 
                        enabled: isEnabled 
                    });
                    continue;
                }
                
                // Click submit button
                await this.humanizer.humanClick(page, selector);
                
                // Wait for response
                await this.waitForSubmissionResult(page, email);
                
                return await this.parseSubmissionResult(page);
                
            } catch (error) {
                logger.debug('Submit button selector failed', { selector, error: error.message });
                continue;
            }
        }
        
        throw new Error('Could not find or click submit button');
    }

    /**
     * Wait for form submission result
     */
    async waitForSubmissionResult(page, email) {
        logger.browserAction(email, 'waiting_for_response');
        
        try {
            // Wait for either success or error
            await Promise.race([
                page.waitForSelector(steamSelectors.successMessage, { timeout: 15000 }),
                page.waitForSelector(steamSelectors.errorMessage, { timeout: 15000 }),
                page.waitForSelector(steamSelectors.emailVerificationMessage, { timeout: 15000 }),
                page.waitForNavigation({ timeout: 15000 })
            ]);
        } catch (error) {
            // Check if we're still on the same page with potential errors
            const currentUrl = page.url();
            if (currentUrl.includes('join')) {
                throw new Error('Form submission may have failed - still on registration page');
            }
        }
    }

    /**
     * Parse the submission result
     */
    async parseSubmissionResult(page) {
        const currentUrl = page.url();
        
        // Check for success indicators
        const successElement = await page.$(steamSelectors.successMessage);
        const emailVerificationElement = await page.$(steamSelectors.emailVerificationMessage);
        
        if (successElement || emailVerificationElement || !currentUrl.includes('join')) {
            return {
                success: true,
                message: 'Account registration initiated',
                requiresEmailVerification: !!emailVerificationElement,
                currentUrl: currentUrl
            };
        }
        
        // Check for error messages
        const errorElement = await page.$(steamSelectors.errorMessage);
        const fieldErrorElement = await page.$(steamSelectors.fieldError);
        
        if (errorElement || fieldErrorElement) {
            const errorText = errorElement ? 
                await errorElement.textContent() : 
                await fieldErrorElement.textContent();
            
            throw new Error(`Registration failed: ${errorText}`);
        }
        
        // If we're still here, something unexpected happened
        throw new Error('Unknown registration result');
    }

    /**
     * Get random country for testing
     */
    getRandomCountry() {
        return steamConfig.testCountries[
            Math.floor(Math.random() * steamConfig.testCountries.length)
        ];
    }

    /**
     * Check if error is proxy-related
     */
    isProxyError(error) {
        const proxyErrorKeywords = [
            'proxy',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'network',
            'connection refused',
            'connection timeout'
        ];
        
        const errorMessage = error.message.toLowerCase();
        return proxyErrorKeywords.some(keyword => errorMessage.includes(keyword));
    }

    /**
     * Cleanup resources for an email
     */
    async cleanup(email) {
        try {
            await this.browser.closeContext(email);
            this.proxyManager.releaseProxy(email);
        } catch (error) {
            logger.warn('Cleanup error', { email, error: error.message });
        }
    }

    /**
     * Get registration statistics
     */
    getStats() {
        return {
            browserStats: this.browser.getStats(),
            proxyStats: this.proxyManager.getStats()
        };
    }
}

module.exports = SteamRegistrar;