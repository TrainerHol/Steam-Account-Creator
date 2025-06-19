/**
 * Steam registration page selectors and configuration
 */
const steamSelectors = {
    // Form fields
    emailInput: 'input[name="email"]',
    confirmEmailInput: 'input[name="reenter_email"]',
    countrySelect: 'select[name="country"]',
    ageCheckbox: 'input[type="checkbox"]',
    
    // Alternative selectors based on browser snapshot
    emailInputAlt: 'textbox[placeholder*="Email"]',
    confirmEmailInputAlt: 'textbox[placeholder*="Confirm"]',
    countrySelectAlt: 'combobox[name*="Country"]',
    ageCheckboxAlt: 'checkbox',
    
    // Buttons
    continueButton: 'button:has-text("Continue")',
    continueButtonAlt: 'input[type="submit"][value*="Continue"]',
    
    // Captcha elements
    hCaptcha: '.h-captcha',
    hCaptchaFrame: 'iframe[src*="hcaptcha"]',
    
    // Error elements
    errorMessage: '.error_msg',
    fieldError: '.field_error',
    
    // Success indicators
    successMessage: '.success_msg',
    emailVerificationMessage: '[class*="verification"]',
    
    // Loading states
    loadingSpinner: '.loading',
    buttonDisabled: 'button[disabled]'
};

/**
 * Steam form interaction configuration
 */
const steamConfig = {
    // Timeouts (in milliseconds)
    timeouts: {
        pageLoad: 30000,
        formFill: 10000,
        captcha: 120000,
        navigation: 15000
    },
    
    // Typing configuration for human-like behavior
    typing: {
        minDelay: 50,
        maxDelay: 150,
        errorProbability: 0.02, // 2% chance of typo
        correctionDelay: 200
    },
    
    // Mouse movement for human-like behavior
    mouse: {
        moveBeforeClick: true,
        randomOffset: 5, // pixels
        clickDelay: { min: 100, max: 300 }
    },
    
    // Form validation patterns
    validation: {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        minPasswordLength: 8
    },
    
    // Countries commonly used for testing
    testCountries: [
        'United States',
        'Canada', 
        'United Kingdom',
        'Germany',
        'France',
        'Australia'
    ]
};

module.exports = {
    steamSelectors,
    steamConfig
};