// tournament-system-init.js
// Ensures tournament system loads properly with all dependencies

console.log('🚀 Initializing WalletWars Tournament System...');

// Track initialization status
window.tournamentSystemStatus = {
    config: false,
    deployment: false,
    lifecycle: false,
    automation: false,
    escrow: false,
    api: false,
    snapshot: false,
    ready: false
};

// Initialize tournament system
async function initializeTournamentSystem() {
    console.log('🔧 Checking tournament system components...');
    
    // Check each component
    const components = [
        {
            name: 'Tournament Config',
            check: () => window.TOURNAMENT_CONFIG && window.validateTournamentConfig,
            status: 'config'
        },
        {
            name: 'WalletWars API',
            check: () => window.walletWarsAPI,
            status: 'api'
        },
        {
            name: 'Escrow Integration',
            check: () => window.WalletWarsEscrowIntegration,
            status: 'escrow'
        },
        {
            name: 'Tournament Deployment Manager',
            check: () => window.TournamentDeploymentManager,
            status: 'deployment'
        },
        {
            name: 'Tournament Lifecycle Manager',
            check: () => window.tournamentLifecycleManager,
            status: 'lifecycle'
        },
        {
            name: 'Tournament Automation',
            check: () => window.tournamentAutomation,
            status: 'automation'
        },
        {
            name: 'Tournament Snapshot Manager',
            check: () => window.tournamentSnapshotManager,
            status: 'snapshot',
            optional: true
        }
    ];
    
    // Check each component
    let allReady = true;
    for (const component of components) {
        const isReady = component.check();
        window.tournamentSystemStatus[component.status] = isReady;
        
        if (isReady) {
            console.log(`✅ ${component.name} - Ready`);
        } else if (component.optional) {
            console.log(`⚠️ ${component.name} - Not available (optional)`);
        } else {
            console.log(`❌ ${component.name} - Missing`);
            allReady = false;
        }
    }
    
    // Additional initialization if all components are ready
    if (allReady) {
        window.tournamentSystemStatus.ready = true;
        console.log('✅ Tournament system fully initialized!');
        
        // Validate configuration
        if (window.validateTournamentConfig) {
            window.validateTournamentConfig();
        }
        
        // Initialize automation if available
        if (window.tournamentAutomation && window.tournamentAutomation.initialize) {
            try {
                await window.tournamentAutomation.initialize();
                console.log('✅ Tournament automation initialized');
            } catch (error) {
                console.warn('⚠️ Tournament automation initialization failed:', error);
            }
        }
        
        return true;
    } else {
        console.error('❌ Tournament system initialization failed - missing components');
        return false;
    }
}

// Retry initialization with timeout
async function retryInitialization(maxAttempts = 10, delay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`🔄 Initialization attempt ${attempt}/${maxAttempts}...`);
        
        const success = await initializeTournamentSystem();
        if (success) {
            return true;
        }
        
        if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    console.error('❌ Failed to initialize tournament system after multiple attempts');
    return false;
}

// Helper function to check tournament system status
function checkTournamentSystemStatus() {
    console.log('📊 Tournament System Status:');
    console.log('================================');
    
    Object.entries(window.tournamentSystemStatus).forEach(([component, status]) => {
        const icon = status ? '✅' : '❌';
        console.log(`${icon} ${component.charAt(0).toUpperCase() + component.slice(1)}: ${status}`);
    });
    
    console.log('================================');
    
    if (window.tournamentSystemStatus.ready) {
        console.log('🎮 System is ready for tournaments!');
    } else {
        console.log('⚠️ System is not fully ready');
        
        // Provide helpful suggestions
        if (!window.tournamentSystemStatus.snapshot) {
            console.log('💡 Snapshot manager missing - tournaments will run without wallet snapshots');
        }
        if (!window.tournamentSystemStatus.api) {
            console.log('💡 WalletWars API missing - check if walletwars-api.js is loaded');
        }
    }
    
    return window.tournamentSystemStatus;
}

// Emergency tournament system reset
function resetTournamentSystem() {
    console.log('🔄 Resetting tournament system...');
    
    // Clear any scheduled events
    if (window.tournamentAutomation && window.tournamentAutomation.clearAllSchedules) {
        window.tournamentAutomation.clearAllSchedules();
    }
    
    // Reset status
    Object.keys(window.tournamentSystemStatus).forEach(key => {
        window.tournamentSystemStatus[key] = false;
    });
    
    console.log('✅ Tournament system reset complete');
}

// Debug helper for tournaments page
window.debugTournaments = function() {
    console.log('🔍 Tournament System Debug Information:');
    
    // Check system status
    checkTournamentSystemStatus();
    
    // Check if tournaments are loading
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const mainContent = document.getElementById('mainContent');
    
    console.log('\n📄 Page State:');
    console.log(`Loading visible: ${loadingState?.style.display !== 'none'}`);
    console.log(`Error visible: ${errorState?.style.display !== 'none'}`);
    console.log(`Main content visible: ${mainContent?.style.display !== 'none'}`);
    
    // Check for tournament data
    if (window.realTournamentData) {
        console.log(`\n🎮 Tournaments loaded: ${window.realTournamentData.length}`);
    }
    
    // Check wallet connection
    if (window.getWalletStatus) {
        const walletStatus = window.getWalletStatus();
        console.log('\n🔗 Wallet Status:', walletStatus);
    }
    
    console.log('\n💡 Try these commands:');
    console.log('- loadTournaments() - Reload tournament data');
    console.log('- checkTournamentSystemStatus() - Check system components');
    console.log('- window.tournamentSetup.checkSystemStatus() - Check setup status');
};

// Export functions
window.initializeTournamentSystem = initializeTournamentSystem;
window.retryInitialization = retryInitialization;
window.checkTournamentSystemStatus = checkTournamentSystemStatus;
window.resetTournamentSystem = resetTournamentSystem;

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 DOM loaded, starting tournament system initialization...');
    
    // Wait a moment for all scripts to load
    setTimeout(async () => {
        const success = await retryInitialization();
        
        if (!success) {
            console.error('❌ Tournament system failed to initialize');
            console.log('💡 Run debugTournaments() for more information');
        }
    }, 500);
});

console.log('✅ Tournament System Initializer loaded!');
console.log('🔧 Run checkTournamentSystemStatus() to check component status');
console.log('🔍 Run debugTournaments() to debug tournament loading issues');