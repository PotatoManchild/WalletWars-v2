// tournament-setup.js - ENHANCED VERSION WITH WEB3.js INTEGRATION
// Enhanced setup and testing script for WalletWars tournaments

console.log('🏗️ Enhanced WalletWars Tournament Setup Script Starting...');

/**
 * Step 1: Setup Initial Tournament Templates (unchanged)
 */
async function setupInitialTournamentTemplates() {
    console.log('🏗️ Setting up initial tournament templates...');
    
    const templates = [
        // Pure Wallet Tournaments
        {
            name: "Rookie Pure Wallet - Monday",
            tournament_type: "weekly",
            trading_style: "pure_wallet",
            start_day: "monday",
            entry_fee: 0.01,
            max_participants: 500,
            prize_pool_percentage: 85.00
        },
        {
            name: "Rookie Pure Wallet - Wednesday",
            tournament_type: "weekly", 
            trading_style: "pure_wallet",
            start_day: "wednesday",
            entry_fee: 0.01,
            max_participants: 500,
            prize_pool_percentage: 85.00
        },
        {
            name: "Rookie Pure Wallet - Friday",
            tournament_type: "weekly",
            trading_style: "pure_wallet", 
            start_day: "friday",
            entry_fee: 0.01,
            max_participants: 500,
            prize_pool_percentage: 85.00
        },
        
        // Open Trading Tournaments
        {
            name: "Elite Open Trading - Monday", 
            tournament_type: "weekly",
            trading_style: "open_trading",
            start_day: "monday",
            entry_fee: 0.05,
            max_participants: 1000,
            prize_pool_percentage: 80.00
        },
        {
            name: "Elite Open Trading - Wednesday",
            tournament_type: "weekly",
            trading_style: "open_trading",
            start_day: "wednesday", 
            entry_fee: 0.05,
            max_participants: 1000,
            prize_pool_percentage: 80.00
        },
        {
            name: "Elite Open Trading - Friday",
            tournament_type: "weekly",
            trading_style: "open_trading",
            start_day: "friday",
            entry_fee: 0.05, 
            max_participants: 1000,
            prize_pool_percentage: 80.00
        },
        
        // Monthly Tournaments
        {
            name: "Monthly Pure Wallet Championship",
            tournament_type: "monthly",
            trading_style: "pure_wallet",
            start_day: "monday",
            entry_fee: 0.02,
            max_participants: 2000,
            prize_pool_percentage: 85.00
        },
        {
            name: "Monthly Open Trading Masters",
            tournament_type: "monthly", 
            trading_style: "open_trading",
            start_day: "monday",
            entry_fee: 0.1,
            max_participants: 2000,
            prize_pool_percentage: 75.00
        }
    ];
    
    let successCount = 0;
    let existingCount = 0;
    
    for (const templateData of templates) {
        try {
            const result = await window.walletWarsAPI.createTournamentTemplate(templateData);
            
            if (result.success) {
                console.log(`✅ Created template: ${templateData.name}`);
                successCount++;
            } else {
                if (result.error.includes('already exists') || result.error.includes('duplicate')) {
                    console.log(`ℹ️ Template already exists: ${templateData.name}`);
                    existingCount++;
                } else {
                    console.error(`❌ Failed to create template ${templateData.name}:`, result.error);
                }
            }
            
        } catch (error) {
            console.error(`❌ Exception creating template ${templateData.name}:`, error);
        }
    }
    
    console.log(`🏆 Template setup complete: ${successCount} created, ${existingCount} already existed`);
    return { created: successCount, existing: existingCount };
}

/**
 * Step 2: Enhanced Wallet Service Integration Test
 */
async function testEnhancedWalletIntegration() {
    console.log('🚀 Testing Enhanced Wallet Service integration...');
    
    try {
        // Check if enhanced wallet service is available
        if (!window.enhancedWalletService) {
            console.warn('⚠️ Enhanced Wallet Service not loaded, checking for fallback...');
            
            if (window.solscanService) {
                console.log('📡 Using Solscan fallback service');
                return { success: true, provider: 'Solscan (Fallback)', enhanced: false };
            } else {
                throw new Error('No wallet service available');
            }
        }

        // Test enhanced service status
        const status = await window.enhancedWalletService.getServiceStatus();
        console.log('📊 Enhanced Wallet Service Status:', status);
        
        if (!status.online) {
            console.warn('⚠️ Enhanced service offline, attempting multi-provider test');
            
            // Test multiple providers
            const multiStatus = await window.enhancedWalletService.getMultiProviderStatus();
            console.log('🔄 Multi-provider status:', multiStatus);
            
            // Find the best available provider
            const availableProvider = Object.values(multiStatus).find(p => p.online);
            if (availableProvider) {
                console.log(`✅ Found alternative provider: ${availableProvider.name}`);
                return { success: true, provider: availableProvider.name, enhanced: true };
            } else {
                throw new Error('All wallet providers offline');
            }
        }
        
        // Test wallet snapshot with enhanced service
        const testAddress = 'So11111111111111111111111111111111111111112';
        const snapshot = await window.enhancedWalletService.getFullWalletSnapshot(testAddress);
        
        console.log('✅ Enhanced wallet snapshot test results:');
        console.log(`💰 SOL Balance: ${snapshot.solBalance}`);
        console.log(`🪙 Token Count: ${snapshot.tokenBalances.length}`);
        console.log(`🔧 Provider: ${snapshot.provider}`);
        console.log(`⏰ Response Time: ${status.responseTime}ms`);
        
        return { 
            success: true, 
            provider: snapshot.provider,
            enhanced: true,
            responseTime: status.responseTime,
            snapshot: snapshot
        };
        
    } catch (error) {
        console.error('❌ Enhanced wallet integration test failed:', error);
        return { success: false, error: error.message, enhanced: false };
    }
}

/**
 * Step 3: Enhanced Sample Tournament Creation
 */
async function createSampleTournament() {
    console.log('🎮 Creating enhanced sample tournament...');
    
    try {
        // Get the first template
        const templatesResult = await window.walletWarsAPI.getTournamentTemplates();
        
        if (!templatesResult.success || templatesResult.templates.length === 0) {
            throw new Error('No tournament templates found. Run setupInitialTournamentTemplates() first.');
        }
        
        const template = templatesResult.templates[0];
        console.log('📋 Using template:', template.name);
        
        // Calculate tournament times
        const now = new Date();
        const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Start in 24 hours
        const endTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later
        const registrationOpens = new Date(now.getTime() + 1 * 60 * 60 * 1000); // Open in 1 hour
        const registrationCloses = new Date(startTime.getTime() - 1 * 60 * 60 * 1000); // Close 1 hour before start
        
        const instanceData = {
            template_id: template.id,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            registration_opens: registrationOpens.toISOString(),
            registration_closes: registrationCloses.toISOString(),
            status: 'upcoming',
            participant_count: 0,
            total_prize_pool: 0
        };
        
        const result = await window.walletWarsAPI.createTournamentInstance(instanceData);
        
        if (result.success) {
            console.log('✅ Enhanced sample tournament created successfully');
            console.log('🎯 Tournament ID:', result.instance.id);
            console.log('📅 Registration opens:', registrationOpens);
            console.log('🚀 Tournament starts:', startTime);
            console.log('🏁 Tournament ends:', endTime);
            
            // Test enhanced wallet integration with this tournament
            console.log('🔄 Testing wallet integration for tournament...');
            const walletTest = await testEnhancedWalletIntegration();
            if (walletTest.success) {
                console.log(`✅ Wallet service ready for tournament (${walletTest.provider})`);
            }
            
            return result.instance;
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('❌ Failed to create enhanced sample tournament:', error);
        return null;
    }
}

/**
 * Step 4: Enhanced Wallet Snapshot Testing
 */
async function testEnhancedWalletSnapshot(walletAddress = null) {
    console.log('📸 Testing enhanced wallet snapshot functionality...');
    
    try {
        // Use a test address if none provided
        const testAddress = walletAddress || 'So11111111111111111111111111111111111111112';
        
        console.log(`Testing enhanced snapshot for address: ${testAddress.substring(0, 8)}...`);
        
        // Determine which service to use
        const walletService = window.enhancedWalletService || window.solscanService;
        
        if (!walletService) {
            throw new Error('No wallet service available');
        }
        
        // Test getting a wallet snapshot
        const snapshot = await walletService.getFullWalletSnapshot(testAddress);
        
        console.log('✅ Enhanced wallet snapshot test results:');
        console.log('💰 SOL Balance:', snapshot.solBalance);
        console.log('🪙 Token Count:', snapshot.tokenBalances.length);
        console.log('💎 Total Value:', snapshot.totalValueSol, 'SOL');
        console.log('🔧 Provider:', snapshot.provider || 'Unknown');
        console.log('⏰ Timestamp:', snapshot.timestamp);
        
        // Test token balances if available
        if (snapshot.tokenBalances.length > 0) {
            console.log('🪙 Sample token holdings:');
            snapshot.tokenBalances.slice(0, 3).forEach((token, index) => {
                console.log(`  ${index + 1}. ${token.uiAmountString || token.amount} tokens (${token.mint.substring(0, 8)}...)`);
            });
        }
        
        // Test performance metrics
        if (window.enhancedWalletService) {
            const serviceStatus = await window.enhancedWalletService.getServiceStatus();
            console.log('⚡ Performance:', serviceStatus.responseTime, 'ms');
            
            const rateLimitStatus = window.enhancedWalletService.rateLimiter.getStatus();
            console.log('🚦 Rate Limit:', `${rateLimitStatus.available}/${rateLimitStatus.maxRequests} available`);
        }
        
        return { success: true, snapshot: snapshot };
        
    } catch (error) {
        console.error('❌ Enhanced wallet snapshot test failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Step 5: Enhanced Tournament Registration Testing
 */
async function testEnhancedTournamentRegistration(championId = null, tournamentId = null) {
    console.log('🎯 Testing enhanced tournament registration...');
    
    try {
        if (!championId) {
            console.log('⚠️ No champion ID provided - skipping registration test');
            return { success: false, error: 'No champion ID provided' };
        }
        
        if (!tournamentId) {
            // Get the first available tournament
            const tournamentsResult = await window.walletWarsAPI.getUpcomingTournaments(1);
            if (!tournamentsResult.success || tournamentsResult.tournaments.length === 0) {
                throw new Error('No upcoming tournaments found');
            }
            tournamentId = tournamentsResult.tournaments[0].id;
        }
        
        console.log(`Attempting enhanced registration: champion ${championId} → tournament ${tournamentId}`);
        
        // Test wallet service before registration
        const walletTest = await testEnhancedWalletIntegration();
        if (!walletTest.success) {
            console.warn('⚠️ Wallet service issues detected, but proceeding with registration test');
        } else {
            console.log(`✅ Wallet service ready (${walletTest.provider})`);
        }
        
        const result = await window.walletWarsAPI.registerForTournament(
            championId,
            tournamentId, 
            'pure_wallet'
        );
        
        if (result.success) {
            console.log('✅ Enhanced tournament registration test successful');
            
            // Test snapshot creation for the registration
            if (walletTest.success) {
                console.log('📸 Testing snapshot creation for registration...');
                try {
                    // This would normally use a real wallet address from the champion
                    const testSnapshot = await testEnhancedWalletSnapshot();
                    if (testSnapshot.success) {
                        console.log('✅ Registration snapshot test successful');
                    }
                } catch (snapshotError) {
                    console.warn('⚠️ Registration snapshot test failed:', snapshotError.message);
                }
            }
            
            return result;
        } else {
            console.log('⚠️ Registration failed (expected if already registered):', result.error);
            return result;
        }
        
    } catch (error) {
        console.error('❌ Enhanced tournament registration test failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Enhanced Main Setup Function
 */
async function runCompleteSetup() {
    console.log('🚀 Running enhanced complete WalletWars tournament setup...');
    
    // Wait for APIs to be ready
    if (!window.walletWarsAPI) {
        console.log('⏳ Waiting for WalletWars API...');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Check for enhanced wallet service
    let walletServiceReady = false;
    if (window.enhancedWalletService) {
        console.log('✅ Enhanced Wallet Service detected');
        walletServiceReady = true;
    } else if (window.solscanService) {
        console.log('⚠️ Using Solscan fallback service');
        walletServiceReady = true;
    } else {
        console.log('⏳ Waiting for wallet service...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        walletServiceReady = !!(window.enhancedWalletService || window.solscanService);
    }
    
    try {
        // Step 1: Setup tournament templates
        console.log('\n🔸 Step 1: Setting up tournament templates');
        await setupInitialTournamentTemplates();
        
        // Step 2: Test enhanced wallet integration
        console.log('\n🔸 Step 2: Testing enhanced wallet integration');
        const walletTest = await testEnhancedWalletIntegration();
        
        // Step 3: Create sample tournament
        console.log('\n🔸 Step 3: Creating enhanced sample tournament');
        const sampleTournament = await createSampleTournament();
        
        // Step 4: Test enhanced wallet snapshot
        console.log('\n🔸 Step 4: Testing enhanced wallet snapshot');
        const snapshotTest = await testEnhancedWalletSnapshot();
        
        // Step 5: Get upcoming tournaments
        console.log('\n🔸 Step 5: Fetching upcoming tournaments');
        const tournamentsResult = await window.walletWarsAPI.getUpcomingTournaments();
        
        if (tournamentsResult.success) {
            console.log(`✅ Found ${tournamentsResult.tournaments.length} upcoming tournaments`);
            tournamentsResult.tournaments.forEach(tournament => {
                console.log(`  🎮 ${tournament.tournament_templates.name} - ${tournament.status}`);
            });
        }
        
        // Step 6: Enhanced service status summary
        console.log('\n🔸 Step 6: Enhanced system status summary');
        const enhancedStatus = await window.walletWarsAPI.getEnhancedServiceStatus();
        
        console.log('\n🎉 Enhanced setup finished!');
        console.log('✅ Enhanced tournament system is ready for testing');
        console.log('\n📊 Setup Summary:');
        console.log(`  • Database: ${enhancedStatus.database ? 'Connected' : 'Disconnected'}`);
        console.log(`  • Wallet Service: ${enhancedStatus.walletServiceProvider}`);
        console.log(`  • Response Time: ${enhancedStatus.walletServiceResponseTime || 'N/A'}ms`);
        console.log(`  • Templates: ${enhancedStatus.templates}`);
        console.log(`  • Tournaments: ${enhancedStatus.tournaments}`);
        
        return {
            success: true,
            enhanced: walletTest.enhanced,
            walletServiceProvider: walletTest.provider,
            sampleTournament: sampleTournament,
            snapshotWorking: snapshotTest.success,
            upcomingTournaments: tournamentsResult.success ? tournamentsResult.tournaments.length : 0,
            systemStatus: enhancedStatus
        };
        
    } catch (error) {
        console.error('❌ Enhanced complete setup failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Enhanced System Status Check
 */
async function checkSystemStatus() {
    console.log('🔍 Checking enhanced WalletWars tournament system status...');
    
    try {
        // Check database connection
        const dbConnected = await window.walletWarsAPI.testConnection();
        console.log(`📊 Database: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}`);
        
        // Check enhanced wallet service
        let walletStatus = { online: false, provider: 'None' };
        if (window.enhancedWalletService) {
            walletStatus = await window.enhancedWalletService.getServiceStatus();
            console.log(`🚀 Enhanced Wallet Service: ${walletStatus.online ? '✅ Online' : '❌ Offline'} (${walletStatus.provider})`);
            
            if (walletStatus.online) {
                const rateLimitStatus = window.enhancedWalletService.rateLimiter.getStatus();
                console.log(`🚦 Rate Limiter: ${rateLimitStatus.available}/${rateLimitStatus.maxRequests} requests available`);
            }
        } else if (window.solscanService) {
            const solscanStatus = await window.solscanService.getAPIStatus();
            walletStatus = { online: solscanStatus.online, provider: 'Solscan (Fallback)' };
            console.log(`📡 Solscan API: ${solscanStatus.online ? '✅ Online' : '❌ Offline'}`);
        } else {
            console.log('❌ No wallet service available');
        }
        
        // Check templates
        const templatesResult = await window.walletWarsAPI.getTournamentTemplates();
        console.log(`📋 Tournament Templates: ${templatesResult.success ? templatesResult.templates.length : 0} available`);
        
        // Check upcoming tournaments
        const tournamentsResult = await window.walletWarsAPI.getUpcomingTournaments();
        console.log(`🎮 Upcoming Tournaments: ${tournamentsResult.success ? tournamentsResult.tournaments.length : 0} scheduled`);
        
        return {
            database: dbConnected,
            walletService: walletStatus.online,
            walletServiceProvider: walletStatus.provider,
            enhanced: !!window.enhancedWalletService,
            templates: templatesResult.success ? templatesResult.templates.length : 0,
            tournaments: tournamentsResult.success ? tournamentsResult.tournaments.length : 0,
            rateLimitAvailable: window.enhancedWalletService ? 
                window.enhancedWalletService.rateLimiter.getStatus().available : 'N/A'
        };
        
    } catch (error) {
        console.error('❌ Enhanced status check failed:', error);
        return { error: error.message };
    }
}

// Export enhanced functions to global scope for easy testing
window.tournamentSetup = {
    // Enhanced functions
    runCompleteSetup,
    checkSystemStatus,
    testEnhancedWalletIntegration,
    testEnhancedWalletSnapshot,
    testEnhancedTournamentRegistration,
    
    // Original functions (enhanced internally)
    setupInitialTournamentTemplates,
    createSampleTournament,
    
    // Aliases for compatibility
    testSolscanIntegration: testEnhancedWalletIntegration,
    testWalletSnapshot: testEnhancedWalletSnapshot,
    testTournamentRegistration: testEnhancedTournamentRegistration
};

console.log('✅ Enhanced Tournament setup script loaded!');
console.log('🎯 Run window.tournamentSetup.runCompleteSetup() to begin enhanced setup');
console.log('🔍 Run window.tournamentSetup.checkSystemStatus() to check enhanced status');
console.log('🚀 Enhanced features: Web3.js integration, multi-provider support, improved performance');
