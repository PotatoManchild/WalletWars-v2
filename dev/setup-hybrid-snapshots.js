// setup-hybrid-snapshots.js - SAFE VERSION WITH CIRCUIT BREAKERS
// This version prevents infinite loops and runaway API calls

console.log('🛡️ Loading SAFE Hybrid Snapshot Setup with Circuit Breakers...');

// Global safety controls
const SETUP_SAFETY = {
    maxSetupAttempts: 3,
    maxApiCallsPerMinute: 20,
    retryDelayMs: 5000,
    exponentialBackoff: true,
    autoSetupEnabled: false, // NEVER auto-run setup
    setupInProgress: false,
    lastSetupAttempt: null,
    apiCallsThisMinute: 0,
    apiCallResetTime: Date.now()
};

// Circuit breaker for API calls
class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 60000; // 1 minute
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failures = 0;
        this.lastFailureTime = null;
        this.successCount = 0;
    }

    async execute(fn) {
        if (this.state === 'OPEN') {
            const now = Date.now();
            if (now - this.lastFailureTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
                console.log(`🔄 Circuit breaker ${this.name} attempting recovery...`);
            } else {
                throw new Error(`Circuit breaker ${this.name} is OPEN - API calls blocked`);
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failures = 0;
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            console.log(`✅ Circuit breaker ${this.name} recovered`);
        }
        this.successCount++;
    }

    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        
        if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
            console.error(`🚫 Circuit breaker ${this.name} OPENED after ${this.failures} failures`);
        }
    }

    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime
        };
    }
}

// Create circuit breakers for different services
const circuitBreakers = {
    wallet: new CircuitBreaker('WalletService', { failureThreshold: 3, resetTimeout: 30000 }),
    database: new CircuitBreaker('Database', { failureThreshold: 5, resetTimeout: 60000 }),
    setup: new CircuitBreaker('Setup', { failureThreshold: 2, resetTimeout: 120000 })
};

// API call rate limiter
function checkApiRateLimit() {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - SETUP_SAFETY.apiCallResetTime > 60000) {
        SETUP_SAFETY.apiCallsThisMinute = 0;
        SETUP_SAFETY.apiCallResetTime = now;
    }
    
    if (SETUP_SAFETY.apiCallsThisMinute >= SETUP_SAFETY.maxApiCallsPerMinute) {
        throw new Error(`API rate limit exceeded: ${SETUP_SAFETY.apiCallsThisMinute}/${SETUP_SAFETY.maxApiCallsPerMinute} calls per minute`);
    }
    
    SETUP_SAFETY.apiCallsThisMinute++;
}

// Safe wallet service wrapper
async function safeWalletServiceCall(method, ...args) {
    checkApiRateLimit();
    
    return await circuitBreakers.wallet.execute(async () => {
        if (!window.enhancedWalletService) {
            throw new Error('Enhanced wallet service not available');
        }
        
        return await window.enhancedWalletService[method](...args);
    });
}

// Main setup function with safety controls
async function setupHybridSnapshots(options = {}) {
    // Prevent concurrent setup attempts
    if (SETUP_SAFETY.setupInProgress) {
        console.warn('⚠️ Setup already in progress, skipping...');
        return false;
    }
    
    // Check if setup was recently attempted
    if (SETUP_SAFETY.lastSetupAttempt) {
        const timeSinceLastAttempt = Date.now() - SETUP_SAFETY.lastSetupAttempt;
        if (timeSinceLastAttempt < 10000) { // 10 seconds
            console.warn(`⚠️ Setup attempted ${Math.floor(timeSinceLastAttempt/1000)}s ago, please wait...`);
            return false;
        }
    }
    
    SETUP_SAFETY.setupInProgress = true;
    SETUP_SAFETY.lastSetupAttempt = Date.now();
    
    try {
        return await circuitBreakers.setup.execute(async () => {
            console.log('📋 SAFE Hybrid Snapshot System Setup');
            console.log('=====================================');
            
            // Step 1: Validate environment
            console.log('\n1️⃣ Validating environment...');
            
            const requiredComponents = [
                { name: 'Tournament Snapshot Manager', check: () => window.tournamentSnapshotManager },
                { name: 'Tournament Automation', check: () => window.tournamentAutomation },
                { name: 'Enhanced Wallet Service', check: () => window.enhancedWalletService },
                { name: 'WalletWars API', check: () => window.walletWarsAPI }
            ];
            
            for (const component of requiredComponents) {
                if (!component.check()) {
                    throw new Error(`Required component missing: ${component.name}`);
                }
                console.log(`✅ ${component.name} loaded`);
            }
            
            // Step 2: Configure with new API key (safely)
            console.log('\n2️⃣ Configuring Helius API key...');
            
            if (window.enhancedWalletService.config && window.enhancedWalletService.config.backup) {
                window.enhancedWalletService.config.backup.rpcUrl = 
                    'https://mainnet.helius-rpc.com/?api-key=cbfd228c-6be2-4493-ae67-5df7dc20a3e8';
                console.log('✅ New Helius API key configured');
            }
            
            // Step 3: Test wallet service (with circuit breaker)
            console.log('\n3️⃣ Testing wallet service safely...');
            
            const testWallet = 'So11111111111111111111111111111111111111112';
            
            try {
                const snapshot = await safeWalletServiceCall('getFullWalletSnapshot', testWallet);
                console.log(`✅ Wallet service working - Test balance: ${snapshot.solBalance} SOL`);
            } catch (error) {
                console.error('❌ Wallet service test failed:', error.message);
                throw new Error('Cannot proceed without working wallet service');
            }
            
            // Step 4: Initialize automation (safely)
            console.log('\n4️⃣ Initializing safe tournament automation...');
            
            await window.tournamentAutomation.initialize();
            
            // Override dangerous methods with safe versions
            const originalSchedule = window.tournamentAutomation.scheduleUpcomingTournaments;
            window.tournamentAutomation.scheduleUpcomingTournaments = async function() {
                console.log('🛡️ Using safe tournament scheduling...');
                checkApiRateLimit();
                return await originalSchedule.call(this);
            };
            
            console.log('✅ Tournament automation initialized with safety controls');
            
            // Step 5: DO NOT auto-schedule tournaments
            console.log('\n5️⃣ Tournament scheduling available (manual trigger required)');
            console.log('⚠️ Auto-scheduling is DISABLED for safety');
            console.log('💡 To schedule tournaments, manually run: scheduleTournamentsSafely()');
            
            // Success summary
            console.log('\n✅ SAFE HYBRID SNAPSHOT SYSTEM READY!');
            console.log('=====================================');
            console.log('🛡️ Safety Features Active:');
            console.log('   • Circuit breakers prevent cascade failures');
            console.log('   • API rate limiting (20 calls/minute max)');
            console.log('   • No automatic setup or scheduling');
            console.log('   • Retry limits with exponential backoff');
            console.log('   • Concurrent execution prevention');
            
            return true;
        });
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        return false;
        
    } finally {
        SETUP_SAFETY.setupInProgress = false;
    }
}

// Safe tournament scheduling function
async function scheduleTournamentsSafely() {
    console.log('🛡️ Attempting to schedule tournaments safely...');
    
    try {
        // Check all circuit breakers
        const allCircuitsClosed = Object.values(circuitBreakers).every(cb => cb.state !== 'OPEN');
        if (!allCircuitsClosed) {
            console.error('❌ Cannot schedule - some circuit breakers are open');
            showCircuitBreakerStatus();
            return false;
        }
        
        // Check API rate limit
        if (SETUP_SAFETY.apiCallsThisMinute >= SETUP_SAFETY.maxApiCallsPerMinute - 5) {
            console.warn('⚠️ Approaching API rate limit, please wait before scheduling');
            return false;
        }
        
        // Schedule with confirmation
        const count = await window.tournamentAutomation.scheduleUpcomingTournaments();
        console.log('✅ Tournaments scheduled successfully');
        
        return true;
        
    } catch (error) {
        console.error('❌ Failed to schedule tournaments:', error.message);
        return false;
    }
}

// Setup with retry logic and exponential backoff
async function setupWithRetry(maxAttempts = 3) {
    let attempts = 0;
    
    async function attempt() {
        attempts++;
        console.log(`\n🔄 Setup attempt ${attempts}/${maxAttempts}`);
        
        try {
            const result = await setupHybridSnapshots();
            if (result) {
                console.log('✅ Setup completed successfully!');
                return true;
            } else {
                throw new Error('Setup returned false');
            }
        } catch (error) {
            console.error(`❌ Attempt ${attempts} failed:`, error.message);
            
            if (attempts < maxAttempts) {
                const delay = SETUP_SAFETY.exponentialBackoff 
                    ? Math.pow(2, attempts) * SETUP_SAFETY.retryDelayMs 
                    : SETUP_SAFETY.retryDelayMs;
                    
                console.log(`⏳ Waiting ${delay/1000} seconds before retry...`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return attempt();
            } else {
                console.error('❌ All setup attempts failed');
                showTroubleshootingGuide();
                return false;
            }
        }
    }
    
    return attempt();
}

// Circuit breaker status display
function showCircuitBreakerStatus() {
    console.log('\n📊 Circuit Breaker Status:');
    console.log('========================');
    
    Object.entries(circuitBreakers).forEach(([name, breaker]) => {
        const status = breaker.getStatus();
        const icon = status.state === 'CLOSED' ? '✅' : 
                    status.state === 'OPEN' ? '🚫' : '🔄';
        
        console.log(`${icon} ${status.name}: ${status.state}`);
        console.log(`   Failures: ${status.failures}, Successes: ${status.successCount}`);
    });
}

// Safety status display
function showSafetyStatus() {
    console.log('\n🛡️ Safety System Status:');
    console.log('======================');
    console.log(`Setup Attempts: ${SETUP_SAFETY.maxSetupAttempts} max`);
    console.log(`API Calls This Minute: ${SETUP_SAFETY.apiCallsThisMinute}/${SETUP_SAFETY.maxApiCallsPerMinute}`);
    console.log(`Setup In Progress: ${SETUP_SAFETY.setupInProgress}`);
    console.log(`Auto-Setup: ${SETUP_SAFETY.autoSetupEnabled ? 'ENABLED ⚠️' : 'DISABLED ✅'}`);
    
    showCircuitBreakerStatus();
}

// Troubleshooting guide
function showTroubleshootingGuide() {
    console.log('\n🔧 Troubleshooting Guide:');
    console.log('=======================');
    console.log('1. Check your internet connection');
    console.log('2. Verify Helius API key is valid');
    console.log('3. Wait 1-2 minutes for rate limits to reset');
    console.log('4. Try: resetSafetySystem()');
    console.log('5. Check browser console for specific errors');
    console.log('6. If issues persist, regenerate your Helius API key');
}

// Reset safety system
function resetSafetySystem() {
    console.log('🔄 Resetting safety system...');
    
    // Reset safety controls
    SETUP_SAFETY.apiCallsThisMinute = 0;
    SETUP_SAFETY.apiCallResetTime = Date.now();
    SETUP_SAFETY.setupInProgress = false;
    SETUP_SAFETY.lastSetupAttempt = null;
    
    // Reset circuit breakers
    Object.values(circuitBreakers).forEach(breaker => {
        breaker.state = 'CLOSED';
        breaker.failures = 0;
        breaker.successCount = 0;
    });
    
    console.log('✅ Safety system reset complete');
}

// Enhanced test hybrid system with safety
window.testHybridSystem = {
    // Safe manual tournament start
    async startTournament(tournamentId) {
        try {
            checkApiRateLimit();
            console.log(`🎮 Safely starting tournament ${tournamentId}...`);
            await window.tournamentAutomation.manualStartTournament(tournamentId);
        } catch (error) {
            console.error('❌ Failed to start tournament:', error.message);
        }
    },
    
    // Safe manual tournament end
    async endTournament(tournamentId) {
        try {
            checkApiRateLimit();
            console.log(`🎮 Safely ending tournament ${tournamentId}...`);
            await window.tournamentAutomation.manualEndTournament(tournamentId);
        } catch (error) {
            console.error('❌ Failed to end tournament:', error.message);
        }
    },
    
    // Safe wallet snapshot test
    async testSnapshot(walletAddress) {
        try {
            console.log(`📸 Safely testing snapshot for ${walletAddress}...`);
            const snapshot = await safeWalletServiceCall('getFullWalletSnapshot', walletAddress);
            console.log('Snapshot result:', snapshot);
            return snapshot;
        } catch (error) {
            console.error('❌ Snapshot test failed:', error.message);
            return null;
        }
    },
    
    // System status checks
    checkStatus() {
        showSafetyStatus();
        
        if (window.tournamentAutomation) {
            const status = window.tournamentAutomation.getStatus();
            console.log('\n🤖 Automation Status:', status);
        }
    },
    
    viewSchedule() {
        if (window.tournamentAutomation) {
            window.tournamentAutomation.showScheduleSummary();
        }
    },
    
    emergencyStop() {
        window.tournamentAutomation.clearAllSchedules();
        console.log('🛑 All tournament schedules cleared');
        resetSafetySystem();
    }
};

// API monitor with safety features
window.apiMonitor = {
    showStatus() {
        showSafetyStatus();
    },
    
    reset() {
        resetSafetySystem();
    },
    
    setLimits(perMinute) {
        SETUP_SAFETY.maxApiCallsPerMinute = perMinute;
        console.log(`✅ API limit set to ${perMinute} calls per minute`);
    }
};

// Export safe functions
window.setupHybridSnapshots = setupHybridSnapshots;
window.setupWithRetry = setupWithRetry;
window.scheduleTournamentsSafely = scheduleTournamentsSafely;
window.showSafetyStatus = showSafetyStatus;
window.resetSafetySystem = resetSafetySystem;

// DO NOT AUTO-RUN ANYTHING!
console.log('\n✅ SAFE Hybrid Snapshot Setup loaded!');
console.log('🛡️ All safety systems active');
console.log('');
console.log('📋 Quick Start Commands:');
console.log('  setupWithRetry()        - Run setup with automatic retry');
console.log('  showSafetyStatus()      - Check all safety systems');
console.log('  scheduleTournamentsSafely() - Schedule tournaments (after setup)');
console.log('');
console.log('⚠️ IMPORTANT: Nothing will auto-run. You have full control.');
