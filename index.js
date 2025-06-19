#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const logger = require('./src/utils/logger');
const config = require('./src/config/env');

// Import services
const ProxyManager = require('./src/services/proxyManager');
const StealthBrowser = require('./src/services/stealthBrowser');
const SteamRegistrar = require('./src/services/steamRegistrar');

class SteamAccountCreator {
    constructor() {
        this.proxyManager = new ProxyManager();
        this.browser = new StealthBrowser();
        this.registrar = new SteamRegistrar(this.browser, this.proxyManager);
        this.results = [];
        this.isRunning = false;
        this.processedCount = 0;
        this.successCount = 0;
        this.failureCount = 0;
    }

    /**
     * Load accounts from CSV file
     */
    async loadAccounts() {
        const accounts = [];
        
        if (!fs.existsSync(config.paths.accounts)) {
            throw new Error(`Accounts file not found: ${config.paths.accounts}`);
        }

        return new Promise((resolve, reject) => {
            fs.createReadStream(config.paths.accounts)
                .pipe(csv())
                .on('data', (row) => {
                    if (row.email && row.password) {
                        accounts.push({
                            email: row.email.trim(),
                            password: row.password.trim(),
                            country: row.country ? row.country.trim() : null
                        });
                    }
                })
                .on('end', () => {
                    logger.info('Accounts loaded', { count: accounts.length });
                    resolve(accounts);
                })
                .on('error', reject);
        });
    }

    /**
     * Process a single account
     */
    async processAccount(account) {
        const startTime = Date.now();
        
        try {
            const result = await this.registrar.registerAccount(
                account.email,
                account.password,
                account.country
            );
            
            const duration = Date.now() - startTime;
            const accountResult = {
                email: account.email,
                success: true,
                result: result,
                duration: duration,
                timestamp: new Date().toISOString()
            };
            
            this.results.push(accountResult);
            this.successCount++;
            
            logger.info('Account processed successfully', { 
                email: account.email, 
                duration 
            });
            
            return accountResult;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            const accountResult = {
                email: account.email,
                success: false,
                error: error.message,
                duration: duration,
                timestamp: new Date().toISOString()
            };
            
            this.results.push(accountResult);
            this.failureCount++;
            
            logger.error('Account processing failed', { 
                email: account.email, 
                error: error.message,
                duration 
            });
            
            return accountResult;
        } finally {
            this.processedCount++;
            
            // Cleanup resources for this account
            await this.registrar.cleanup(account.email);
            
            // Application delay between accounts
            await this.delay(config.app.delayRange.min);
        }
    }

    /**
     * Process accounts with concurrency control
     */
    async processAccounts(accounts) {
        this.isRunning = true;
        const maxConcurrent = config.app.maxConcurrentAccounts;
        
        logger.info('Starting account creation', { 
            total: accounts.length,
            maxConcurrent 
        });

        // Process accounts in batches
        for (let i = 0; i < accounts.length; i += maxConcurrent) {
            if (!this.isRunning) {
                logger.info('Processing stopped by user');
                break;
            }
            
            const batch = accounts.slice(i, i + maxConcurrent);
            const batchPromises = batch.map(account => this.processAccount(account));
            
            // Wait for batch to complete
            await Promise.allSettled(batchPromises);
            
            // Save progress after each batch
            await this.saveResults();
            
            // Log progress
            const progress = Math.round((this.processedCount / accounts.length) * 100);
            logger.info('Progress update', {
                processed: this.processedCount,
                total: accounts.length,
                success: this.successCount,
                failures: this.failureCount,
                progress: `${progress}%`
            });
            
            // Delay between batches to avoid detection
            if (i + maxConcurrent < accounts.length) {
                await this.delay(config.app.delayRange.max);
            }
        }
        
        this.isRunning = false;
        logger.info('Account creation completed', {
            total: accounts.length,
            processed: this.processedCount,
            success: this.successCount,
            failures: this.failureCount,
            successRate: `${Math.round((this.successCount / this.processedCount) * 100)}%`
        });
    }

    /**
     * Save results to JSON file
     */
    async saveResults() {
        try {
            const resultsData = {
                summary: {
                    total: this.processedCount,
                    success: this.successCount,
                    failures: this.failureCount,
                    successRate: this.processedCount > 0 ? 
                        Math.round((this.successCount / this.processedCount) * 100) : 0,
                    lastUpdated: new Date().toISOString()
                },
                results: this.results
            };
            
            const resultsDir = path.dirname(config.paths.results);
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
            }
            
            fs.writeFileSync(config.paths.results, JSON.stringify(resultsData, null, 2));
            logger.debug('Results saved', { file: config.paths.results });
            
        } catch (error) {
            logger.error('Failed to save results', { error: error.message });
        }
    }

    /**
     * Load existing results if available
     */
    loadExistingResults() {
        try {
            if (fs.existsSync(config.paths.results)) {
                const data = JSON.parse(fs.readFileSync(config.paths.results, 'utf8'));
                this.results = data.results || [];
                this.processedCount = data.summary?.total || 0;
                this.successCount = data.summary?.success || 0;
                this.failureCount = data.summary?.failures || 0;
                
                logger.info('Loaded existing results', {
                    processed: this.processedCount,
                    success: this.successCount,
                    failures: this.failureCount
                });
            }
        } catch (error) {
            logger.warn('Could not load existing results', { error: error.message });
        }
    }

    /**
     * Display statistics
     */
    displayStats() {
        const stats = {
            application: {
                processed: this.processedCount,
                success: this.successCount,
                failures: this.failureCount,
                isRunning: this.isRunning
            },
            registrar: this.registrar.getStats()
        };
        
        console.log('\n=== Steam Account Creator Statistics ===');
        console.log(JSON.stringify(stats, null, 2));
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        logger.info('Shutting down...');
        this.isRunning = false;
        
        try {
            await this.saveResults();
            await this.browser.close();
            logger.info('Shutdown completed');
        } catch (error) {
            logger.error('Error during shutdown', { error: error.message });
        }
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Main execution function
     */
    async run() {
        try {
            logger.info('Steam Account Creator starting up', {
                config: {
                    maxConcurrent: config.app.maxConcurrentAccounts,
                    headless: config.app.headless,
                    debug: config.app.debug
                }
            });
            
            // Load existing results
            this.loadExistingResults();
            
            // Load accounts to process
            const accounts = await this.loadAccounts();
            
            if (accounts.length === 0) {
                throw new Error('No accounts found to process');
            }
            
            // Filter out already processed accounts if resuming
            const unprocessedAccounts = accounts.filter(account => 
                !this.results.some(result => result.email === account.email)
            );
            
            if (unprocessedAccounts.length === 0) {
                logger.info('All accounts have already been processed');
                this.displayStats();
                return;
            }
            
            logger.info('Processing accounts', {
                total: accounts.length,
                unprocessed: unprocessedAccounts.length,
                alreadyProcessed: accounts.length - unprocessedAccounts.length
            });
            
            // Process accounts
            await this.processAccounts(unprocessedAccounts);
            
            // Final save and stats
            await this.saveResults();
            this.displayStats();
            
        } catch (error) {
            logger.error('Application error', { error: error.message });
            throw error;
        }
    }
}

// Handle process termination gracefully
const creator = new SteamAccountCreator();

process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await creator.shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    await creator.shutdown();
    process.exit(0);
});

// Main execution
if (require.main === module) {
    creator.run().catch(async (error) => {
        logger.error('Fatal error', { error: error.message });
        await creator.shutdown();
        process.exit(1);
    });
}

module.exports = SteamAccountCreator;