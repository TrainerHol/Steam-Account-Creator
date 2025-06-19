const config = require('../config/env');

/**
 * Human-like interaction utilities for Playwright automation
 */
class Humanizer {
    constructor() {
        this.typingErrors = [
            { from: 'a', to: 's' },
            { from: 's', to: 'a' },
            { from: 'd', to: 's' },
            { from: 'f', to: 'd' },
            { from: 'g', to: 'f' },
            { from: 'h', to: 'g' },
            { from: 'j', to: 'h' },
            { from: 'k', to: 'j' },
            { from: 'l', to: 'k' },
            { from: 'q', to: 'w' },
            { from: 'w', to: 'q' },
            { from: 'e', to: 'w' },
            { from: 'r', to: 'e' },
            { from: 't', to: 'r' },
            { from: 'y', to: 't' },
            { from: 'u', to: 'y' },
            { from: 'i', to: 'u' },
            { from: 'o', to: 'i' },
            { from: 'p', to: 'o' }
        ];
    }

    /**
     * Type text with human-like behavior including occasional typos
     */
    async humanType(page, selector, text, options = {}) {
        const {
            errorProbability = 0.02,
            minDelay = 50,
            maxDelay = 150,
            correctionDelay = 200
        } = options;

        // Clear existing text first
        await page.fill(selector, '');
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            // Random chance of making a typo
            if (Math.random() < errorProbability) {
                const typo = this.getTypo(char);
                if (typo) {
                    // Type the wrong character
                    await page.type(selector, typo, { delay: this.randomDelay(minDelay, maxDelay) });
                    await this.delay(correctionDelay);
                    
                    // Backspace to correct
                    await page.keyboard.press('Backspace');
                    await this.delay(correctionDelay / 2);
                }
            }
            
            // Type the correct character
            await page.type(selector, char, { delay: this.randomDelay(minDelay, maxDelay) });
        }
    }

    /**
     * Click with human-like mouse movement
     */
    async humanClick(page, selector, options = {}) {
        const {
            moveToElement = true,
            randomOffset = 5,
            clickDelay = { min: 100, max: 300 }
        } = options;

        if (moveToElement) {
            await this.humanHover(page, selector, { randomOffset });
        }
        
        await this.delay(this.randomDelay(clickDelay.min, clickDelay.max));
        await page.click(selector);
    }

    /**
     * Hover with slight random offset for human-like movement
     */
    async humanHover(page, selector, options = {}) {
        const { randomOffset = 5 } = options;
        
        const element = await page.$(selector);
        if (!element) {
            throw new Error(`Element not found: ${selector}`);
        }

        const box = await element.boundingBox();
        if (!box) {
            throw new Error(`Element has no bounding box: ${selector}`);
        }

        const x = box.x + box.width / 2 + (Math.random() - 0.5) * randomOffset * 2;
        const y = box.y + box.height / 2 + (Math.random() - 0.5) * randomOffset * 2;

        await page.mouse.move(x, y);
        await this.delay(this.randomDelay(50, 150));
    }

    /**
     * Fill form field with realistic human behavior
     */
    async fillFormField(page, selector, value, options = {}) {
        await this.humanClick(page, selector);
        await this.delay(this.randomDelay(100, 300));
        await this.humanType(page, selector, value, options);
    }

    /**
     * Select dropdown option with human-like behavior
     */
    async selectDropdown(page, selector, value, options = {}) {
        await this.humanClick(page, selector);
        await this.delay(this.randomDelay(300, 600));
        
        // Try different selection methods
        try {
            await page.selectOption(selector, value);
        } catch (error) {
            // Fallback: try selecting by visible text
            await page.selectOption(selector, { label: value });
        }
        
        // Wait for selection to process
        await this.delay(this.randomDelay(200, 400));
        
        // Close dropdown by clicking elsewhere or pressing Escape
        try {
            await page.keyboard.press('Escape');
            await this.delay(this.randomDelay(100, 200));
        } catch (error) {
            // If Escape doesn't work, try clicking elsewhere
            try {
                await page.click('body');
                await this.delay(this.randomDelay(100, 200));
            } catch (clickError) {
                // Ignore if both methods fail
            }
        }
    }

    /**
     * Scroll page like a human
     */
    async humanScroll(page, direction = 'down', distance = 300) {
        const scrollSteps = Math.floor(distance / 50) + Math.floor(Math.random() * 3);
        const stepDistance = distance / scrollSteps;
        
        for (let i = 0; i < scrollSteps; i++) {
            await page.evaluate(({ step, dir }) => {
                window.scrollBy(0, dir === 'down' ? step : -step);
            }, { step: stepDistance, dir: direction });
            
            await this.delay(this.randomDelay(100, 300));
        }
    }

    /**
     * Wait with human-like behavior (reading, thinking)
     */
    async humanPause(reason = 'reading') {
        const delays = {
            reading: { min: 1000, max: 3000 },
            thinking: { min: 2000, max: 5000 },
            loading: { min: 500, max: 1500 },
            typing: { min: 200, max: 800 }
        };
        
        const delayRange = delays[reason] || delays.reading;
        await this.delay(this.randomDelay(delayRange.min, delayRange.max));
    }

    /**
     * Navigate to page with realistic timing
     */
    async humanNavigate(page, url, options = {}) {
        const { waitForLoad = true, readingTime = true } = options;
        
        await page.goto(url, { 
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        if (waitForLoad) {
            await this.delay(this.randomDelay(1000, 2000));
        }
        
        if (readingTime) {
            await this.humanPause('reading');
        }
    }

    /**
     * Handle checkbox with human-like behavior
     */
    async handleCheckbox(page, selector, shouldCheck = true) {
        const isChecked = await page.isChecked(selector);
        
        if (isChecked !== shouldCheck) {
            await this.humanClick(page, selector);
            await this.delay(this.randomDelay(200, 500));
        }
    }

    /**
     * Get a typo for a character
     */
    getTypo(char) {
        const error = this.typingErrors.find(e => e.from === char.toLowerCase());
        return error ? error.to : null;
    }

    /**
     * Random delay within range
     */
    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Application-specific delay based on config
     */
    async appDelay() {
        const min = config.app.delayRange.min;
        const max = config.app.delayRange.max;
        await this.delay(this.randomDelay(min, max));
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Simulate reading a page
     */
    async simulateReading(page, sections = 1) {
        for (let i = 0; i < sections; i++) {
            // Scroll down a bit
            await this.humanScroll(page, 'down', 100 + Math.random() * 200);
            
            // Pause to "read"
            await this.humanPause('reading');
            
            if (Math.random() > 0.7) {
                // Sometimes scroll back up like re-reading
                await this.humanScroll(page, 'up', 50);
                await this.delay(this.randomDelay(500, 1000));
            }
        }
    }

    /**
     * Check if element is visible and ready for interaction
     */
    async waitForInteractable(page, selector, timeout = 10000) {
        await page.waitForSelector(selector, { 
            state: 'visible', 
            timeout 
        });
        
        // Additional check for element to be ready
        await page.waitForFunction(
            selector => {
                const element = document.querySelector(selector);
                return element && !element.disabled && element.offsetParent !== null;
            },
            selector,
            { timeout }
        );
    }

    /**
     * Type with realistic speed variation
     */
    getRealisticTypingSpeed() {
        // Base typing speed: 40-80 WPM
        // 1 WPM = 5 characters per minute
        // Convert to milliseconds per character
        const wpm = 40 + Math.random() * 40; // 40-80 WPM
        const cpm = wpm * 5; // characters per minute
        const cps = cpm / 60; // characters per second
        const msPerChar = 1000 / cps; // milliseconds per character
        
        // Add some variation
        return msPerChar + (Math.random() - 0.5) * msPerChar * 0.3;
    }
}

module.exports = Humanizer;