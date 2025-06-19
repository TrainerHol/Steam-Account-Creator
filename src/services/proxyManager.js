const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.assignedProxies = new Map(); // email -> proxy mapping
        this.failedProxies = new Set();
        this.lastProxyFetch = 0;
        this.rateLimitDelay = 0;
        
        // Rate limiting for WebShare API
        this.requestCounts = {
            general: { count: 0, resetTime: Date.now() + 60000 },
            proxyList: { count: 0, resetTime: Date.now() + 60000 }
        };
    }

    /**
     * Check and enforce rate limits
     */
    async enforceRateLimit(type = 'general') {
        const now = Date.now();
        const rateLimit = this.requestCounts[type];
        
        // Reset counters if time window passed
        if (now >= rateLimit.resetTime) {
            rateLimit.count = 0;
            rateLimit.resetTime = now + 60000; // 1 minute window
        }
        
        const maxRequests = type === 'proxyList' ? 
            config.webshare.rateLimitProxyList : 
            config.webshare.rateLimitGeneral;
        
        if (rateLimit.count >= maxRequests) {
            const waitTime = rateLimit.resetTime - now;
            logger.rateLimitHit('webshare-' + type, new Date(rateLimit.resetTime));
            await this.delay(waitTime);
            
            // Reset after waiting
            rateLimit.count = 0;
            rateLimit.resetTime = now + 60000;
        }
        
        rateLimit.count++;
    }

    /**
     * Fetch proxy list from WebShare API
     */
    async fetchProxies() {
        if (!config.webshare.apiToken) {
            logger.info('WebShare not configured - skipping proxy fetch');
            return [];
        }

        try {
            await this.enforceRateLimit('proxyList');
            
            const response = await axios.get(`${config.webshare.baseUrl}/proxy/list/`, {
                headers: {
                    'Authorization': `Token ${config.webshare.apiToken}`
                },
                params: {
                    page_size: 100,
                    mode: 'direct'
                },
                timeout: 10000
            });

            if (response.data && response.data.results) {
                this.proxies = response.data.results.filter(proxy => 
                    proxy.valid && !this.failedProxies.has(proxy.id)
                );
                
                logger.info('Proxy list updated', { 
                    total: this.proxies.length,
                    failed: this.failedProxies.size 
                });
                
                this.lastProxyFetch = Date.now();
                return this.proxies;
            } else {
                throw new Error('Invalid response format from WebShare API');
            }
        } catch (error) {
            logger.error('Failed to fetch proxies', { error: error.message });
            throw error;
        }
    }

    /**
     * Get a proxy for a specific email account
     */
    async getProxyForAccount(email) {
        // Check if WebShare is configured
        if (!config.webshare.apiToken) {
            logger.info('No proxy configured - running without proxy', { email });
            return null;
        }

        // Return existing proxy if already assigned
        if (this.assignedProxies.has(email)) {
            const existingProxy = this.assignedProxies.get(email);
            if (!this.failedProxies.has(existingProxy.id)) {
                return existingProxy;
            }
        }

        // Refresh proxy list if empty or stale (older than 10 minutes)
        if (this.proxies.length === 0 || 
            (Date.now() - this.lastProxyFetch) > 600000) {
            await this.fetchProxies();
        }

        // Find an unassigned proxy
        const availableProxy = this.proxies.find(proxy => 
            !Array.from(this.assignedProxies.values()).some(assigned => assigned.id === proxy.id) &&
            !this.failedProxies.has(proxy.id)
        );

        if (!availableProxy) {
            // If no available proxies, try to refresh the list
            await this.fetchProxies();
            const retryProxy = this.proxies.find(proxy => 
                !Array.from(this.assignedProxies.values()).some(assigned => assigned.id === proxy.id) &&
                !this.failedProxies.has(proxy.id)
            );
            
            if (!retryProxy) {
                logger.warn('No available proxies - continuing without proxy', { email });
                return null;
            }
            
            this.assignedProxies.set(email, retryProxy);
            logger.proxyAssigned(email, retryProxy);
            return retryProxy;
        }

        this.assignedProxies.set(email, availableProxy);
        logger.proxyAssigned(email, availableProxy);
        return availableProxy;
    }

    /**
     * Mark a proxy as failed and get a new one
     */
    async markProxyFailed(email, proxy, error) {
        logger.proxyFailed(proxy, error);
        this.failedProxies.add(proxy.id);
        
        // Remove from assigned proxies
        if (this.assignedProxies.get(email) === proxy) {
            this.assignedProxies.delete(email);
        }
        
        // Try to get a new proxy
        try {
            return await this.getProxyForAccount(email);
        } catch (retryError) {
            logger.error('Failed to get replacement proxy', { 
                email, 
                error: retryError.message 
            });
            throw retryError;
        }
    }

    /**
     * Convert WebShare proxy format to Playwright proxy format
     */
    formatProxyForPlaywright(proxy) {
        if (!proxy) return null;
        
        return {
            server: `http://${proxy.proxy_address}:${proxy.port}`,
            username: proxy.username,
            password: proxy.password
        };
    }

    /**
     * Get proxy statistics
     */
    getStats() {
        return {
            totalProxies: this.proxies.length,
            assignedProxies: this.assignedProxies.size,
            failedProxies: this.failedProxies.size,
            availableProxies: this.proxies.length - this.assignedProxies.size - this.failedProxies.size,
            lastFetch: new Date(this.lastProxyFetch).toISOString()
        };
    }

    /**
     * Test proxy connectivity
     */
    async testProxy(proxy) {
        try {
            const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}`;
            
            const response = await axios.get('https://httpbin.org/ip', {
                proxy: false,
                httpsAgent: new (require('https').Agent)({
                    rejectUnauthorized: false
                }),
                timeout: 10000,
                headers: {
                    'User-Agent': config.steam.userAgent
                }
            });
            
            return response.status === 200;
        } catch (error) {
            logger.debug('Proxy test failed', { 
                proxy: `${proxy.proxy_address}:${proxy.port}`,
                error: error.message 
            });
            return false;
        }
    }

    /**
     * Release proxy assignment for an account
     */
    releaseProxy(email) {
        if (this.assignedProxies.has(email)) {
            const proxy = this.assignedProxies.get(email);
            this.assignedProxies.delete(email);
            logger.debug('Proxy released', { 
                email, 
                proxy: `${proxy.proxy_address}:${proxy.port}` 
            });
        }
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ProxyManager;