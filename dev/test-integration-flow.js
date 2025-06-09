// test-integration-flow.js
// Complete test flow for WalletWars tournament system with TEST MODE

console.log('🧪 Loading Test Integration Flow...');

/**
 * Complete test flow demonstrating all components
 */
async function runCompleteTestFlow() {
    console.log('🚀 Starting complete test flow...');
    console.log('=' .repeat(50));
    
    try {
        // Step 1: Verify test mode is active
        console.log('\n📋 Step 1: Verifying test mode...');
        if (!window.tournamentTestMode || !window.tournamentTestMode.isEnabled()) {
            throw new Error('Test mode is not enabled. Enable it first for safety.');
        }
        console.log('✅ Test mode is active - safe to proceed');
        
        // Step 2: Check all dependencies
        console.log('\n📋 Step 2: Checking dependencies...');
        const deps = checkDependencies();
        if (!deps.allLoaded) {
            throw new Error('Missing dependencies: ' + deps.missing.join(', '));
        }
        console.log('✅ All dependencies loaded');
        
        // Step 3: Test database connection
        console.log('\n📋 Step 3: Testing database connection...');
        const dbConnected = await testDatabaseConnection();
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }
        console.log('✅ Database connected');
        
        // Step 4: Create mock wallet for testing
        console.log('\n📋 Step 4: Creating mock wallet...');
        const mockWallet = createMockWallet();
        console.log('✅ Mock wallet created:', mockWallet.publicKey.toString());
        
        // Step 5: Initialize deployment manager
        console.log('\n📋 Step 5: Initializing deployment manager...');
        const deploymentManager = new window.EnhancedTournamentDeploymentManager();
        await deploymentManager.initializeEscrow(mockWallet);
        console.log('✅ Deployment manager initialized');
        
        // Step 6: Create a test tournament
        console.log('\n📋 Step 6: Creating test tournament...');
        const tournament = await createTestTournament(deploymentManager);
        if (!tournament) {
            throw new Error('Failed to create test tournament');
        }
        console.log('✅ Test tournament created:', tournament.id);
        console.log('  - Name:', tournament.tournament_name);
        console.log('  - Status:', tournament.status);
        console.log('  - Mock PDA:', tournament.deployment_metadata.tournamentPDA);
        
        // Step 7: Test player registration
        console.log('\n📋 Step 7: Testing player registration...');
        const registration = await testPlayerRegistration(tournament.deployment_metadata.tournamentId);
        if (registration.success) {
            console.log('✅ Mock registration successful');
            console.log('  - Transaction:', registration.signature);
            console.log('  - Entry fee:', registration.entryFeePaid, 'SOL');
        }
        
        // Step 8: Check mock data
        console.log('\n📋 Step 8: Checking mock data...');
        const mockData = getMockDataSummary();
        console.log('📊 Mock Data Summary:');
        console.log('  - Tournaments:', mockData.tournaments);
        console.log('  - Registrations:', mockData.registrations);
        console.log('  - Transactions:', mockData.transactions);
        
        // Step 9: Demonstrate one real test capability
        console.log('\n📋 Step 9: One real test capability...');
        console.log('⚠️  The system can create ONE real tournament when needed');
        console.log('  - Current status:', window.tournamentTestMode.config.realTestUsed ? 'USED' : 'AVAILABLE');
        console.log('  - Use tournamentTestMode.enableOneRealTest() when ready');
        
        // Step 10: Show deployment statistics
        console.log('\n📋 Step 10: Deployment statistics...');
        const stats = deploymentManager.getStats();
        console.log('📊 Deployment Stats:');
        console.log('  - Total created:', stats.tournamentsCreated);
        console.log('  - Mock tournaments:', stats.mockTournamentsCreated);
        console.log('  - Real tournaments:', stats.realTournamentsCreated);
        console.log('  - Failed attempts:', stats.failedAttempts);
        
        console.log('\n' + '=' .repeat(50));
        console.log('✅ Complete test flow finished successfully!');
        console.log('🎉 The system is working correctly in TEST MODE');
        
        return {
            success: true,
            tournament: tournament,
            stats: stats
        };
        
    } catch (error) {
        console.error('❌ Test flow failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Check all required dependencies
 */
function checkDependencies() {
    const required = [
        'walletWarsAPI',
        'tournamentTestMode',
        'EnhancedTournamentDeploymentManager',
        'WalletWarsEscrowIntegration',
        'TOURNAMENT_CONFIG'
    ];
    
    const missing = [];
    
    required.forEach(dep => {
        if (!window[dep]) {
            missing.push(dep);
            console.log(`❌ Missing: ${dep}`);
        } else {
            console.log(`✅ Found: ${dep}`);
        }
    });
    
    return {
        allLoaded: missing.length === 0,
        missing: missing
    };
}

/**
 * Test database connection
 */
async function testDatabaseConnection() {
    try {
        const connected = await window.walletWarsAPI.testConnection();
        return connected;
    } catch (error) {
        console.error('Database test error:', error);
        return false;
    }
}

/**
 * Create a mock wallet for testing
 */
function createMockWallet() {
    // Create a mock wallet that mimics Phantom's interface
    const mockPublicKey = {
        toString: () => 'MOCK_WALLET_' + Math.random().toString(36).substring(7).toUpperCase(),
        toBuffer: () => Buffer.from('mock_wallet', 'utf8')
    };
    
    return {
        publicKey: mockPublicKey,
        isPhantom: true,
        connect: async () => ({ publicKey: mockPublicKey }),
        disconnect: async () => {},
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs
    };
}

/**
 * Create a test tournament
 */
async function createTestTournament(deploymentManager) {
    const testVariant = {
        name: 'Integration Test Tournament',
        tradingStyle: 'pure_wallet',
        maxParticipants: 50,
        minParticipants: 5,
        entryFee: 0.01,
        duration: 3,
        prizePoolPercentage: 85
    };
    
    const startDate = new Date();
    startDate.setHours(startDate.getHours() + 2); // Start in 2 hours
    
    try {
        const tournament = await deploymentManager.createTournamentWithEscrow(startDate, testVariant);
        return tournament;
    } catch (error) {
        console.error('Failed to create test tournament:', error);
        return null;
    }
}

/**
 * Test player registration (mock)
 */
async function testPlayerRegistration(tournamentId) {
    try {
        const testMode = window.tournamentTestMode;
        const result = await testMode.mockRegisterPlayer(tournamentId, 'TEST_PLAYER_WALLET');
        return result;
    } catch (error) {
        console.error('Registration test failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get mock data summary
 */
function getMockDataSummary() {
    const testMode = window.tournamentTestMode;
    return {
        tournaments: testMode.config.mockTournaments.size,
        registrations: testMode.config.mockRegistrations.size,
        transactions: testMode.config.mockTransactions.length
    };
}

/**
 * Quick test functions for console use
 */
window.testFlow = {
    // Run complete flow
    runComplete: runCompleteTestFlow,
    
    // Individual test functions
    checkDeps: checkDependencies,
    testDB: testDatabaseConnection,
    
    // Quick tournament creation
    quickTournament: async () => {
        console.log('Creating quick test tournament...');
        const manager = new window.EnhancedTournamentDeploymentManager();
        const mockWallet = createMockWallet();
        await manager.initializeEscrow(mockWallet);
        return await manager.createTestTournament();
    },
    
    // Show current test mode status
    status: () => {
        const testMode = window.tournamentTestMode;
        console.log('🧪 Test Mode Status:');
        console.log('  - Enabled:', testMode.isEnabled());
        console.log('  - Mock tournaments:', testMode.config.mockTournaments.size);
        console.log('  - Mock registrations:', testMode.config.mockRegistrations.size);
        console.log('  - Mock transactions:', testMode.config.mockTransactions.length);
        console.log('  - One real test:', testMode.config.realTestUsed ? 'USED' : 'AVAILABLE');
    },
    
    // Clear all test data
    clearAll: () => {
        if (confirm('Clear all mock data?')) {
            window.tournamentTestMode.clearMockData();
            console.log('✅ All mock data cleared');
        }
    }
};

console.log('✅ Test Integration Flow loaded!');
console.log('🧪 Run testFlow.runComplete() to test the entire system');
console.log('📊 Run testFlow.status() to check current test mode status');
console.log('🎮 Run testFlow.quickTournament() to create a quick test tournament');