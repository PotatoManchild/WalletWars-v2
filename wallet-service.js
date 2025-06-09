// wallet-service.js - UPDATED WITH NEW HELIUS API KEY
// Enhanced wallet tracking service using Web3.js with working RPC endpoints
// Updated with new Helius API key: cbfd228c-6be2-4493-ae67-5df7dc20a3e8

console.log('🚀 Loading Enhanced Wallet Service with NEW API Key...');

class EnhancedWalletService {
    constructor() {
        this.rateLimiter = new RateLimiter(30, 60000); // 30 req/min for safety
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        
        // Configuration with NEW HELIUS API KEY
        this.config = {
            // Primary: Solana Web3.js with public RPC
            primary: {
                name: 'Solana Web3.js',
                rpcUrl: 'https://api.mainnet-beta.solana.com',
                type: 'web3js',
                priority: 1
            },
            // Backup: Helius with NEW API KEY
            backup: {
                name: 'Helius',
                rpcUrl: 'https://mainnet.helius-rpc.com/?api-key=cbfd228c-6be2-4493-ae67-5df7dc20a3e8',
                type: 'helius',
                priority: 2
            },
            // Fallback: Alternative public RPC
            fallback: {
                name: 'Ankr Public',
                rpcUrl: 'https://rpc.ankr.com/solana',
                type: 'web3js',
                priority: 3
            }
        };
        
        // Additional backup endpoints if needed
        this.additionalEndpoints = [
            'https://rpc.ankr.com/solana',
            'https://ssc-dao.genesysgo.net',
            'https://solana.rpcpool.com'
        ];
        
        this.currentProvider = this.config.primary;
        this.web3Connection = null;
        this.backupConnection = null;
        this.fallbackConnection = null;
        
        // API usage tracking
        this.apiUsageStats = {
            calls: 0,
            lastReset: Date.now(),
            callHistory: []
        };
        
        this.initializeConnections();
        
        console.log('✅ Enhanced Wallet Service initialized with NEW Helius API key');
        console.log('🔑 New API Key: cbfd228c-6be2-4493-ae67-5df7dc20a3e8');
    }

    /**
     * Track API usage for monitoring
     */
    trackApiCall(provider, method) {
        this.apiUsageStats.calls++;
        this.apiUsageStats.callHistory.push({
            provider,
            method,
            timestamp: Date.now()
        });
        
        // Keep only last 100 calls in history
        if (this.apiUsageStats.callHistory.length > 100) {
            this.apiUsageStats.callHistory = this.apiUsageStats.callHistory.slice(-100);
        }
    }

    /**
     * Get API usage statistics
     */
    getApiUsageStats() {
        const now = Date.now();
        const timeSinceReset = now - this.apiUsageStats.lastReset;
        const callsPerMinute = (this.apiUsageStats.calls / (timeSinceReset / 60000)).toFixed(2);
        
        return {
            totalCalls: this.apiUsageStats.calls,
            callsPerMinute,
            timeSinceReset: Math.floor(timeSinceReset / 1000) + 's',
            recentCalls: this.apiUsageStats.callHistory.slice(-10)
        };
    }

    /**
     * Initialize Web3.js connections
     */
    initializeConnections() {
        try {
            // Import Web3.js if available
            if (typeof window !== 'undefined' && window.solanaWeb3) {
                this.Connection = window.solanaWeb3.Connection;
                this.PublicKey = window.solanaWeb3.PublicKey;
                this.LAMPORTS_PER_SOL = window.solanaWeb3.LAMPORTS_PER_SOL || 1000000000;
                
                console.log('✅ Solana Web3.js loaded successfully');
                this.createConnections();
            } else {
                console.warn('⚠️ Solana Web3.js not loaded yet, will retry when needed');
                // Set up retry mechanism
                this.setupWeb3Retry();
            }
            
        } catch (error) {
            console.error('❌ Error initializing connections:', error);
        }
    }

    /**
     * Setup retry mechanism for Web3.js loading
     */
    setupWeb3Retry() {
        let retryCount = 0;
        const maxRetries = 10;
        
        const retryInterval = setInterval(() => {
            retryCount++;
            
            if (window.solanaWeb3) {
                clearInterval(retryInterval);
                console.log('✅ Solana Web3.js loaded after retry');
                this.Connection = window.solanaWeb3.Connection;
                this.PublicKey = window.solanaWeb3.PublicKey;
                this.LAMPORTS_PER_SOL = window.solanaWeb3.LAMPORTS_PER_SOL || 1000000000;
                this.createConnections();
            } else if (retryCount >= maxRetries) {
                clearInterval(retryInterval);
                console.error('❌ Failed to load Solana Web3.js after maximum retries');
            }
        }, 1000);
    }

    /**
     * Create connection instances with commitment level
     */
    createConnections() {
        try {
            if (!this.Connection) {
                console.warn('⚠️ Connection class not available yet');
                return;
            }

            // Create connections with 'finalized' commitment for stability
            const connectionConfig = {
                commitment: 'finalized',
                confirmTransactionInitialTimeout: 60000
            };

            this.web3Connection = new this.Connection(
                this.config.primary.rpcUrl, 
                connectionConfig
            );
            console.log(`🔗 Primary connection established: ${this.config.primary.name}`);
            
            // Create backup connections
            this.backupConnection = new this.Connection(
                this.config.backup.rpcUrl,
                connectionConfig
            );
            console.log(`🔗 Backup connection established: ${this.config.backup.name} (NEW API KEY)`);
            
            this.fallbackConnection = new this.Connection(
                this.config.fallback.rpcUrl,
                connectionConfig
            );
            console.log(`🔗 Fallback connection established: ${this.config.fallback.name}`);
            
        } catch (error) {
            console.error('❌ Error creating connections:', error);
        }
    }

    /**
     * Ensure connections are ready before use
     */
    async ensureConnectionsReady() {
        if (!this.web3Connection && this.Connection) {
            console.log('🔄 Recreating connections...');
            this.createConnections();
            
            // Wait a moment for connections to establish
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!this.web3Connection) {
            throw new Error('Web3.js connections not ready');
        }
    }

    /**
     * Get wallet SOL balance using Web3.js with fallback logic
     * @param {string} walletAddress - Solana wallet address
     * @returns {Object} Balance data
     */
    async getWalletBalance(walletAddress) {
        await this.rateLimiter.wait();
        
        // Validate address first
        if (!this.isValidSolanaAddress(walletAddress)) {
            throw new Error('Invalid Solana wallet address');
        }
        
        try {
            console.log(`💰 Fetching SOL balance for: ${walletAddress.substring(0, 8)}...`);
            
            // Ensure connections are ready
            await this.ensureConnectionsReady();
            
            if (!this.PublicKey) {
                throw new Error('PublicKey class not available from Web3.js');
            }
            
            // Create PublicKey instance
            const publicKey = new this.PublicKey(walletAddress);
            
            // Try primary connection first
            try {
                const balanceInLamports = await this.web3Connection.getBalance(publicKey);
                const solBalance = balanceInLamports / this.LAMPORTS_PER_SOL;
                
                this.trackApiCall(this.config.primary.name, 'getBalance');
                console.log(`✅ SOL Balance retrieved: ${solBalance} SOL (${this.config.primary.name})`);
                
                return {
                    solBalance: solBalance,
                    lamports: balanceInLamports,
                    provider: this.config.primary.name,
                    timestamp: new Date().toISOString()
                };
            } catch (primaryError) {
                console.warn(`⚠️ Primary provider failed: ${primaryError.message}`);
                
                // Try backup connection (Helius with NEW API KEY)
                if (this.backupConnection) {
                    try {
                        const balanceInLamports = await this.backupConnection.getBalance(publicKey);
                        const solBalance = balanceInLamports / this.LAMPORTS_PER_SOL;
                        
                        this.trackApiCall(this.config.backup.name, 'getBalance');
                        console.log(`✅ SOL Balance retrieved via backup: ${solBalance} SOL (${this.config.backup.name} - NEW KEY)`);
                        
                        return {
                            solBalance: solBalance,
                            lamports: balanceInLamports,
                            provider: this.config.backup.name,
                            timestamp: new Date().toISOString()
                        };
                    } catch (backupError) {
                        console.warn(`⚠️ Backup provider failed: ${backupError.message}`);
                        
                        // Try fallback connection
                        if (this.fallbackConnection) {
                            const balanceInLamports = await this.fallbackConnection.getBalance(publicKey);
                            const solBalance = balanceInLamports / this.LAMPORTS_PER_SOL;
                            
                            this.trackApiCall(this.config.fallback.name, 'getBalance');
                            console.log(`✅ SOL Balance retrieved via fallback: ${solBalance} SOL (${this.config.fallback.name})`);
                            
                            return {
                                solBalance: solBalance,
                                lamports: balanceInLamports,
                                provider: this.config.fallback.name,
                                timestamp: new Date().toISOString()
                            };
                        }
                    }
                }
                
                throw primaryError;
            }
            
        } catch (error) {
            console.error(`❌ All providers failed for ${walletAddress.substring(0, 8)}:`, error);
            
            // Last resort: try additional endpoints
            return await this.tryAdditionalEndpoints(walletAddress, error);
        }
    }

    /**
     * Try additional RPC endpoints as last resort
     */
    async tryAdditionalEndpoints(walletAddress, originalError) {
        console.log('🔄 Trying additional RPC endpoints...');
        
        for (const endpoint of this.additionalEndpoints) {
            try {
                console.log(`🔄 Trying ${endpoint}...`);
                
                const connection = new this.Connection(endpoint, 'finalized');
                const publicKey = new this.PublicKey(walletAddress);
                const balanceInLamports = await connection.getBalance(publicKey);
                const solBalance = balanceInLamports / this.LAMPORTS_PER_SOL;
                
                this.trackApiCall(endpoint.split('//')[1].split('/')[0], 'getBalance');
                console.log(`✅ Success with ${endpoint}: ${solBalance} SOL`);
                
                return {
                    solBalance: solBalance,
                    lamports: balanceInLamports,
                    provider: endpoint.split('//')[1].split('/')[0],
                    timestamp: new Date().toISOString()
                };
                
            } catch (error) {
                console.warn(`⚠️ ${endpoint} failed: ${error.message}`);
                continue;
            }
        }
        
        throw new Error(`All wallet providers failed. Please try again later. Original error: ${originalError.message}`);
    }

    /**
     * Get wallet token balances using enhanced APIs
     * @param {string} walletAddress - Solana wallet address
     * @returns {Array} Array of token holdings
     */
    async getTokenBalances(walletAddress) {
        await this.rateLimiter.wait();
        
        try {
            console.log(`🪙 Fetching token balances for: ${walletAddress.substring(0, 8)}...`);
            
            await this.ensureConnectionsReady();
            
            if (!this.PublicKey) {
                throw new Error('PublicKey class not available');
            }
            
            const publicKey = new this.PublicKey(walletAddress);
            
            // Try to get token accounts
            let tokenAccounts = null;
            let usedProvider = null;
            
            // Try primary connection first
            try {
                const TOKEN_PROGRAM_ID = new this.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
                tokenAccounts = await this.web3Connection.getParsedTokenAccountsByOwner(
                    publicKey,
                    { programId: TOKEN_PROGRAM_ID }
                );
                usedProvider = this.config.primary.name;
                this.trackApiCall(usedProvider, 'getParsedTokenAccountsByOwner');
            } catch (primaryError) {
                console.warn(`⚠️ Primary provider failed for tokens: ${primaryError.message}`);
                
                // Try backup (Helius with NEW KEY)
                if (this.backupConnection) {
                    try {
                        const TOKEN_PROGRAM_ID = new this.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
                        tokenAccounts = await this.backupConnection.getParsedTokenAccountsByOwner(
                            publicKey,
                            { programId: TOKEN_PROGRAM_ID }
                        );
                        usedProvider = this.config.backup.name;
                        this.trackApiCall(usedProvider, 'getParsedTokenAccountsByOwner');
                    } catch (backupError) {
                        console.warn(`⚠️ Backup provider failed for tokens: ${backupError.message}`);
                        throw backupError;
                    }
                }
            }
            
            if (!tokenAccounts) {
                console.warn('⚠️ Could not fetch token accounts');
                return [];
            }
            
            const tokenBalances = tokenAccounts.value
                .filter(account => {
                    const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
                    return amount > 0; // Only return tokens with balance
                })
                .map(account => {
                    const parsedInfo = account.account.data.parsed.info;
                    return {
                        mint: parsedInfo.mint,
                        owner: parsedInfo.owner,
                        amount: parsedInfo.tokenAmount.amount,
                        decimals: parsedInfo.tokenAmount.decimals,
                        uiAmount: parsedInfo.tokenAmount.uiAmount,
                        uiAmountString: parsedInfo.tokenAmount.uiAmountString
                    };
                });
            
            console.log(`✅ Found ${tokenBalances.length} token holdings (${usedProvider})`);
            
            return tokenBalances;
            
        } catch (error) {
            console.error(`❌ Token balance fetch error for ${walletAddress.substring(0, 8)}:`, error);
            // Return empty array on error - we can still track SOL balance
            return [];
        }
    }

    /**
     * Get complete wallet snapshot with all balances
     * @param {string} walletAddress - Solana wallet address
     * @returns {Object} Complete wallet state snapshot
     */
    async getFullWalletSnapshot(walletAddress) {
        try {
            console.log(`📸 Taking full wallet snapshot for: ${walletAddress.substring(0, 8)}...`);
            
            // Validate address
            if (!this.isValidSolanaAddress(walletAddress)) {
                throw new Error('Invalid Solana wallet address');
            }
            
            // Get both SOL balance and token balances
            const [balanceData, tokenData] = await Promise.all([
                this.getWalletBalance(walletAddress),
                this.getTokenBalances(walletAddress).catch(err => {
                    console.warn('⚠️ Token fetch failed, continuing with SOL only:', err.message);
                    return [];
                })
            ]);
            
            // Calculate total value (for now, just SOL - can add token values later)
            const totalValue = this.calculateTotalValue(balanceData.solBalance, tokenData);
            
            const snapshot = {
                address: walletAddress,
                solBalance: balanceData.solBalance,
                tokenBalances: tokenData,
                totalValueSol: totalValue,
                timestamp: new Date().toISOString(),
                provider: balanceData.provider,
                raw: { 
                    balanceData, 
                    tokenData,
                    snapshotTime: Date.now()
                }
            };
            
            console.log(`✅ Wallet snapshot complete - Total value: ${totalValue} SOL (Provider: ${balanceData.provider})`);
            
            return snapshot;
            
        } catch (error) {
            console.error(`❌ Failed to get wallet snapshot for ${walletAddress.substring(0, 8)}:`, error);
            throw error;
        }
    }

    /**
     * Calculate total wallet value in SOL terms
     * @param {number} solBalance - SOL balance
     * @param {Array} tokenBalances - Token holdings
     * @returns {number} Total value in SOL
     */
    calculateTotalValue(solBalance, tokenBalances) {
        let totalValue = solBalance;
        
        // For MVP, only count SOL
        // Later enhancement: add major token values (USDC, USDT, etc.)
        // Example future implementation:
        // const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        // tokenBalances.forEach(token => {
        //     if (token.mint === USDC_MINT) {
        //         totalValue += token.uiAmount * getUSDCToSOLRate();
        //     }
        // });
        
        return totalValue;
    }

    /**
     * Validate that a wallet address is properly formatted
     * @param {string} address - Wallet address to validate
     * @returns {boolean} True if valid
     */
    isValidSolanaAddress(address) {
        if (!address || typeof address !== 'string') {
            return false;
        }
        
        // Basic Solana address validation (32-44 characters, base58)
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        return base58Regex.test(address);
    }

    /**
     * Check if Helius API key is properly configured
     */
    isApiKeyConfigured() {
        return this.config.backup.rpcUrl.includes('cbfd228c-6be2-4493-ae67-5df7dc20a3e8');
    }

    /**
     * Get current service status
     * @returns {Object} Service health status
     */
    async getServiceStatus() {
        try {
            await this.ensureConnectionsReady();
            
            // Test primary connection
            const testAddress = 'So11111111111111111111111111111111111111112'; // SOL token mint
            const startTime = Date.now();
            
            const balanceResult = await this.getWalletBalance(testAddress);
            
            const responseTime = Date.now() - startTime;
            
            return {
                online: true,
                provider: balanceResult.provider,
                responseTime: responseTime,
                timestamp: new Date().toISOString(),
                heliusKeyConfigured: this.isApiKeyConfigured()
            };
            
        } catch (error) {
            return {
                online: false,
                error: error.message,
                provider: this.currentProvider.name,
                timestamp: new Date().toISOString(),
                heliusKeyConfigured: this.isApiKeyConfigured()
            };
        }
    }

    /**
     * Get transaction history for anti-cheat monitoring
     * @param {string} walletAddress - Solana wallet address
     * @param {number} limit - Number of transactions to fetch
     * @returns {Array} Transaction history
     */
    async getTransactionHistory(walletAddress, limit = 50) {
        await this.rateLimiter.wait();
        
        try {
            console.log(`📋 Fetching transaction history for: ${walletAddress.substring(0, 8)}... (limit: ${limit})`);
            
            await this.ensureConnectionsReady();
            
            if (!this.PublicKey) {
                throw new Error('PublicKey class not available');
            }
            
            const publicKey = new this.PublicKey(walletAddress);
            
            // Try to get signatures with fallback
            let signatures = null;
            
            try {
                signatures = await this.web3Connection.getSignaturesForAddress(
                    publicKey,
                    { limit: limit }
                );
                this.trackApiCall(this.config.primary.name, 'getSignaturesForAddress');
            } catch (primaryError) {
                console.warn('⚠️ Primary provider failed for transactions, trying backup...');
                
                if (this.backupConnection) {
                    signatures = await this.backupConnection.getSignaturesForAddress(
                        publicKey,
                        { limit: limit }
                    );
                    this.trackApiCall(this.config.backup.name, 'getSignaturesForAddress');
                }
            }
            
            if (!signatures) {
                throw new Error('Could not fetch transaction signatures');
            }
            
            console.log(`✅ Retrieved ${signatures.length} transaction signatures`);
            
            return signatures;
            
        } catch (error) {
            console.error(`❌ Transaction history error for ${walletAddress.substring(0, 8)}:`, error);
            throw error;
        }
    }

    /**
     * Test all configured RPC endpoints
     */
    async getMultiProviderStatus() {
        const statuses = {};
        
        // Test configured endpoints
        for (const [key, config] of Object.entries(this.config)) {
            try {
                const connection = new this.Connection(config.rpcUrl, 'finalized');
                const testAddress = new this.PublicKey('So11111111111111111111111111111111111111112');
                
                const startTime = Date.now();
                await connection.getBalance(testAddress);
                const responseTime = Date.now() - startTime;
                
                statuses[name] = {
                    name: name,
                    online: true,
                    responseTime: responseTime,
                    priority: 99
                };
                
            } catch (error) {
                statuses[name] = {
                    name: name,
                    online: false,
                    error: error.message,
                    priority: 99
                };
            }
        }
        
        return statuses;
    }
}

/**
 * Rate limiter utility class
 */
class RateLimiter {
    constructor(maxRequests, timeWindow) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
        
        console.log(`🚦 Rate limiter initialized: ${maxRequests} requests per ${timeWindow/1000}s`);
    }

    async wait() {
        const now = Date.now();
        
        // Remove old requests outside time window
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        
        // If we're at the limit, wait
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = Math.min(...this.requests);
            const waitTime = this.timeWindow - (now - oldestRequest) + 100; // Add 100ms buffer
            
            if (waitTime > 0) {
                console.log(`⏳ Rate limit reached, waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this.wait(); // Recursive call after waiting
            }
        }
        
        // Record this request
        this.requests.push(now);
    }

    getStatus() {
        const now = Date.now();
        const activeRequests = this.requests.filter(time => now - time < this.timeWindow);
        
        return {
            requestsInWindow: activeRequests.length,
            maxRequests: this.maxRequests,
            timeWindow: this.timeWindow,
            available: this.maxRequests - activeRequests.length,
            percentUsed: (activeRequests.length / this.maxRequests) * 100
        };
    }
}

// Create global instance
let walletServiceInstance = null;

function initializeWalletService() {
    if (!walletServiceInstance) {
        walletServiceInstance = new EnhancedWalletService();
        window.enhancedWalletService = walletServiceInstance;
        console.log('🎯 Enhanced Wallet Service available globally as window.enhancedWalletService');
        console.log('🔑 Using NEW Helius API key: cbfd228c-6be2-4493-ae67-5df7dc20a3e8');
    }
    return walletServiceInstance;
}

// Initialize when Web3.js is available
if (typeof window !== 'undefined') {
    // Check if Web3.js is already loaded
    if (window.solanaWeb3) {
        initializeWalletService();
    } else {
        // Wait for Web3.js to load
        let checkCount = 0;
        const checkForWeb3 = setInterval(() => {
            checkCount++;
            
            if (window.solanaWeb3) {
                clearInterval(checkForWeb3);
                console.log(`✅ Solana Web3.js detected after ${checkCount} checks`);
                initializeWalletService();
            } else if (checkCount > 20) {
                clearInterval(checkForWeb3);
                console.warn('⚠️ Solana Web3.js not detected after 10 seconds, initializing anyway');
                initializeWalletService();
            }
        }, 500);
    }
}

console.log('✅ Enhanced Wallet Service module loaded with NEW API KEY!');() - startTime;
                
                statuses[key] = {
                    name: config.name,
                    online: true,
                    responseTime: responseTime,
                    priority: config.priority,
                    isHelius: config.name === 'Helius',
                    hasNewKey: config.name === 'Helius' && config.rpcUrl.includes('cbfd228c-6be2-4493-ae67-5df7dc20a3e8')
                };
                
            } catch (error) {
                statuses[key] = {
                    name: config.name,
                    online: false,
                    error: error.message,
                    priority: config.priority,
                    isHelius: config.name === 'Helius',
                    hasNewKey: config.name === 'Helius' && config.rpcUrl.includes('cbfd228c-6be2-4493-ae67-5df7dc20a3e8')
                };
            }
        }
        
        // Test additional endpoints
        for (const endpoint of this.additionalEndpoints) {
            const name = endpoint.split('//')[1].split('/')[0];
            
            try {
                const connection = new this.Connection(endpoint, 'finalized');
                const testAddress = new this.PublicKey('So11111111111111111111111111111111111111112');
                
                const startTime = Date.now();
                await connection.getBalance(testAddress);
                const responseTime = Date.now
