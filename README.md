# Steam Account Creator

Automated Steam account creation tool with advanced stealth features, proxy rotation, and captcha solving capabilities.

## ⚠️ Legal Notice

This tool is for educational and research purposes only. Automated account creation may violate Steam's Terms of Service. Use at your own risk and ensure compliance with applicable laws and service terms.

## Features

- **Advanced Stealth**: Playwright with fingerprinting and stealth plugins
- **Proxy Rotation**: WebShare integration with 1:1 account-proxy association
- **Captcha Solving**: BrightData primary solver with 2Captcha/Anti-Captcha fallbacks
- **Human-like Behavior**: Realistic typing patterns, mouse movements, and timing
- **Geographic Consistency**: Proxy location matching with browser locale
- **Error Recovery**: Comprehensive retry logic and fallback systems
- **Progress Tracking**: JSON-based persistence with resume capability

## Prerequisites

- Node.js 16+ 
- WebShare proxy service account
- BrightData account (recommended for captcha solving)
- Optional: 2Captcha or Anti-Captcha account for fallback

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd steam-account-creator
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npx playwright install chromium
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API credentials
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Required
WEBSHARE_API_TOKEN=your_webshare_api_token_here
BRIGHTDATA_API_TOKEN=your_brightdata_api_token_here

# Optional fallback captcha solvers
TWOCAPTCHA_API_KEY=your_2captcha_api_key_here
ANTICAPTCHA_API_KEY=your_anticaptcha_api_key_here

# Application settings
MAX_CONCURRENT_ACCOUNTS=3
DELAY_RANGE_MIN=2000
DELAY_RANGE_MAX=8000
HEADLESS=true
DEBUG=false
```

### Account Input

Create `src/data/accounts.csv` with email/password pairs:

```csv
email,password,country
test1@example.com,SecurePassword123!,United States
test2@example.com,SecurePassword456!,Canada
test3@example.com,SecurePassword789!,United Kingdom
```

## Usage

### Standard Mode
```bash
npm start
```

### Development Mode (visible browser)
```bash
npm run dev
```

### Direct Node Execution
```bash
node index.js
```

## Features in Detail

### Stealth & Anti-Detection

- **Browser Fingerprinting**: Unique fingerprints per account with realistic properties
- **Playwright Stealth**: Removes automation detection markers
- **Human Behavior**: Realistic typing speed, mouse movement, and interaction patterns
- **Geographic Consistency**: Proxy location matches browser locale and timezone

### Proxy Management

- **WebShare Integration**: Automatic proxy fetching and rotation
- **Rate Limiting**: Respects API limits (180 general, 20 proxy requests/min)
- **Health Monitoring**: Automatic proxy failure detection and replacement
- **1:1 Association**: Each account gets a dedicated proxy throughout the process

### Captcha Resolution

- **Primary**: BrightData (99% hCaptcha success rate)
- **Fallback**: 2Captcha → Anti-Captcha chain
- **Auto-Detection**: Automatically detects and solves hCaptcha challenges
- **Error Recovery**: Seamless fallback between solving services

### Progress Tracking

- **Persistent State**: JSON-based result storage with resume capability
- **Real-time Logging**: Structured logging with Winston
- **Statistics**: Success rates, processing times, and detailed metrics
- **Graceful Shutdown**: Ctrl+C handling with state preservation

## Project Structure

```
src/
├── config/
│   ├── env.js              # Environment configuration
│   ├── fingerprints.js     # Browser fingerprint profiles
│   └── steam-selectors.js  # Steam form selectors
├── services/
│   ├── proxyManager.js     # WebShare API integration
│   ├── captchaSolver.js    # Multi-solver captcha resolution
│   ├── stealthBrowser.js   # Enhanced Playwright setup
│   └── steamRegistrar.js   # Registration automation
├── utils/
│   ├── fingerprinter.js    # Browser fingerprint generation
│   ├── humanizer.js        # Human-like interactions
│   └── logger.js           # Structured logging
├── data/
│   ├── accounts.csv        # Input: email/password pairs
│   ├── results.json        # Output: creation results
│   └── fingerprints.json   # Generated browser fingerprints
└── index.js                # Main application entry
```

## Output

Results are saved to `src/data/results.json`:

```json
{
  "summary": {
    "total": 10,
    "success": 8,
    "failures": 2,
    "successRate": 80,
    "lastUpdated": "2024-01-20T10:30:00.000Z"
  },
  "results": [
    {
      "email": "test1@example.com",
      "success": true,
      "result": {
        "success": true,
        "message": "Account registration initiated",
        "requiresEmailVerification": true
      },
      "duration": 45000,
      "timestamp": "2024-01-20T10:25:00.000Z"
    }
  ]
}
```

## Rate Limiting & Safety

- **Concurrent Limit**: Default 3 simultaneous registrations
- **Request Delays**: 2-8 second random delays between actions
- **API Respect**: WebShare rate limits automatically enforced
- **Batch Processing**: Processes accounts in controlled batches
- **Error Recovery**: Automatic retry with different proxies on failures

## Troubleshooting

### Common Issues

1. **Proxy Connection Failures**
   - Verify WebShare API token
   - Check proxy pool availability
   - Review rate limiting logs

2. **Captcha Solving Failures**
   - Verify BrightData API credentials
   - Check fallback solver configurations
   - Monitor captcha solver balance

3. **Steam Detection**
   - Reduce concurrent account limit
   - Increase delays between requests
   - Verify fingerprint diversity

### Debug Mode

Enable debug logging:
```bash
DEBUG=true HEADLESS=false npm start
```

## Performance Optimization

- **Concurrency**: Adjust `MAX_CONCURRENT_ACCOUNTS` based on resources
- **Delays**: Increase `DELAY_RANGE_*` values for better stealth
- **Proxy Pool**: Ensure sufficient proxy diversity
- **Fingerprints**: Monitor fingerprint generation and rotation

## Security Considerations

- **API Keys**: Never commit credentials to version control
- **Logs**: Review logs for sensitive information before sharing
- **Rate Limits**: Respect service provider rate limits
- **Detection**: Monitor for anti-bot countermeasures

## License

ISC License - See LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review logs for error details
3. Verify all API credentials and configurations