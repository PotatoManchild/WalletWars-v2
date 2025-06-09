// tournament-config.js
// Enhanced configuration for tiered tournament system

const TOURNAMENT_CONFIG = {
    // Weekly tier configuration
    weeklyTiers: {
        bronze: {
            name: 'Bronze League',
            entryFee: 0.01,
            maxParticipants: 100,
            minParticipants: 10,
            prizePoolPercentage: 85,
            winnerShare: 50,
            icon: '🥉'
        },
        silver: {
            name: 'Silver League',
            entryFee: 0.05,
            maxParticipants: 100,
            minParticipants: 10,
            prizePoolPercentage: 85,
            winnerShare: 45,
            icon: '🥈'
        },
        gold: {
            name: 'Gold League',
            entryFee: 0.1,
            maxParticipants: 100,
            minParticipants: 10,
            prizePoolPercentage: 85,
            winnerShare: 40,
            icon: '🥇'
        },
        diamond: {
            name: 'Diamond League',
            entryFee: 0.25,
            maxParticipants: 50,
            minParticipants: 10,
            prizePoolPercentage: 85,
            winnerShare: 35,
            icon: '💎'
        }
    },
    
    // Monthly mega tournament configuration
    monthlyMega: {
        name: 'Monthly Mega Championship',
        entryFee: 0.5,
        maxParticipants: 500,
        minParticipants: 50,
        prizePoolPercentage: 90,
        winnerShare: 25,
        icon: '🏆'
    },
    
    // Deployment schedule - Only Monday and Thursday
    deploymentDays: ['monday', 'thursday'],
    deploymentTime: '14:00:00', // UTC (9 AM EST, 6 AM PST)
    
    // Tournament variants to create each deployment day
    // EXACTLY 6 variants = 6 tournaments per deployment day
    tournamentVariants: [
        // Pure Wallet Tournaments (3 tiers)
        {
            name: 'Pure Wallet Bronze League',
            tradingStyle: 'pure_wallet',
            maxParticipants: 100,
            minParticipants: 10,
            entryFee: 0.01,
            duration: 7, // days
            prizePoolPercentage: 85
        },
        {
            name: 'Pure Wallet Silver League',
            tradingStyle: 'pure_wallet',
            maxParticipants: 100,
            minParticipants: 10,
            entryFee: 0.05,
            duration: 7,
            prizePoolPercentage: 85
        },
        {
            name: 'Pure Wallet Gold League',
            tradingStyle: 'pure_wallet',
            maxParticipants: 100,
            minParticipants: 10,
            entryFee: 0.1,
            duration: 7,
            prizePoolPercentage: 85
        },
        
        // Open Trading Tournaments (3 tiers)
        {
            name: 'Open Trading Bronze Battle',
            tradingStyle: 'open_trading',
            maxParticipants: 100,
            minParticipants: 10,
            entryFee: 0.01,
            duration: 7,
            prizePoolPercentage: 80
        },
        {
            name: 'Open Trading Silver Storm',
            tradingStyle: 'open_trading',
            maxParticipants: 100,
            minParticipants: 10,
            entryFee: 0.05,
            duration: 7,
            prizePoolPercentage: 80
        },
        {
            name: 'Open Trading Gold Rush',
            tradingStyle: 'open_trading',
            maxParticipants: 100,
            minParticipants: 10,
            entryFee: 0.1,
            duration: 7,
            prizePoolPercentage: 80
        }
    ],
    
    // Timing configuration
    timing: {
        registrationCloseBeforeStart: 10, // minutes
        minimumCheckTime: 10, // minutes before start
        advanceDeploymentDays: 21, // Deploy 3 weeks ahead
        maxTournamentsPerDate: 6, // Exact number we want per deployment date
        deploymentCooldown: 3600000, // 1 hour between deployment checks (in ms)
        maxUpcomingTournaments: 36 // 6 tournaments × 6 upcoming dates = max 36
    },
    
    // Prize distribution based on participants
    prizeDistribution: {
        // For small tournaments (10-49 participants)
        small: {
            minParticipants: 10,
            distribution: [50, 30, 20] // Top 3 winners
        },
        // For medium tournaments (50-99 participants)
        medium: {
            minParticipants: 50,
            distribution: [35, 25, 15, 10, 8, 7] // Top 6 winners
        },
        // For large tournaments (100+ participants)
        large: {
            minParticipants: 100,
            distribution: [30, 20, 15, 10, 8, 7, 5, 3, 2] // Top 9 winners
        },
        // For mega tournaments (monthly)
        mega: {
            minParticipants: 50,
            distribution: [25, 15, 10, 8, 6, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1] // Top 20 winners
        }
    },
    
    // Validation rules
    validation: {
        // Ensure no duplicate tournaments on same day
        preventDuplicates: true,
        // Check for existing tournaments before creating
        checkExistence: true,
        // Maximum retries for failed deployments
        maxRetries: 3,
        // Minimum time between deployment attempts
        retryDelay: 300000 // 5 minutes
    },
    
    // Escrow configuration
    escrow: {
        programId: 'AXMwpemCzKXiozQhcMtxajPGQwiz4SWfb3xvH42RXuT7',
        platformWallet: '5RLDuPHsa7ohaKUSNc5iYvtgveL1qrCcVdxVHXPeG3b8',
        platformFeePercentage: 10, // 10% platform fee
        refundGracePeriod: 24 * 60 * 60 * 1000 // 24 hours in ms
    },
    
    // Admin configuration
    admin: {
        walletAddress: '6PoB9i9kpumDze7EhiL3CicAuEPxDAzrTVzHYot9sx9h',
        canCreateTournaments: true,
        canModifyTournaments: true,
        canCancelTournaments: true,
        canDistributePrizes: true
    }
};

// Validation function to ensure config integrity
function validateTournamentConfig() {
    const config = TOURNAMENT_CONFIG;
    const issues = [];
    
    // Check that we have the right number of variants
    if (config.tournamentVariants.length !== 6) {
        issues.push(`Expected exactly 6 tournament variants, found ${config.tournamentVariants.length}`);
    }
    
    // Check deployment days
    if (config.deploymentDays.length !== 2) {
        issues.push(`Expected exactly 2 deployment days, found ${config.deploymentDays.length}`);
    }
    
    // Check for duplicate variant names
    const names = config.tournamentVariants.map(v => v.name);
    const uniqueNames = [...new Set(names)];
    if (names.length !== uniqueNames.length) {
        issues.push('Duplicate tournament variant names detected');
    }
    
    // Check entry fee coverage (should have 0.01, 0.05, 0.1 for each trading style)
    const feesByStyle = {};
    config.tournamentVariants.forEach(v => {
        if (!feesByStyle[v.tradingStyle]) feesByStyle[v.tradingStyle] = [];
        feesByStyle[v.tradingStyle].push(v.entryFee);
    });
    
    const expectedFees = [0.01, 0.05, 0.1];
    Object.keys(feesByStyle).forEach(style => {
        const fees = feesByStyle[style].sort();
        if (JSON.stringify(fees) !== JSON.stringify(expectedFees)) {
            issues.push(`Trading style ${style} doesn't have expected fees [0.01, 0.05, 0.1]`);
        }
    });
    
    if (issues.length > 0) {
        console.error('❌ Tournament configuration validation failed:');
        issues.forEach(issue => console.error(`  - ${issue}`));
        return false;
    }
    
    console.log('✅ Tournament configuration validation passed');
    return true;
}

// Calculate expected tournaments per week
function getExpectedTournamentCount() {
    const deploymentsPerWeek = TOURNAMENT_CONFIG.deploymentDays.length; // 2 (Mon, Thu)
    const tournamentsPerDeployment = TOURNAMENT_CONFIG.tournamentVariants.length; // 6
    const totalPerWeek = deploymentsPerWeek * tournamentsPerDeployment; // 12
    
    console.log(`📊 Expected tournaments per week: ${totalPerWeek}`);
    console.log(`📊 Deployments per week: ${deploymentsPerWeek}`);
    console.log(`📊 Tournaments per deployment: ${tournamentsPerDeployment}`);
    
    return {
        totalPerWeek,
        deploymentsPerWeek,
        tournamentsPerDeployment
    };
}

// Get tier configuration
function getTierConfig(tier) {
    return TOURNAMENT_CONFIG.weeklyTiers[tier] || null;
}

// Get prize distribution for participant count
function getPrizeDistribution(participantCount, isMonthly = false) {
    const config = TOURNAMENT_CONFIG.prizeDistribution;
    
    if (isMonthly) {
        return config.mega.distribution;
    }
    
    if (participantCount >= config.large.minParticipants) {
        return config.large.distribution;
    } else if (participantCount >= config.medium.minParticipants) {
        return config.medium.distribution;
    } else {
        return config.small.distribution;
    }
}

// Check if a wallet is admin
function isAdminWallet(walletAddress) {
    return walletAddress === TOURNAMENT_CONFIG.admin.walletAddress;
}

// Make it available globally
window.TOURNAMENT_CONFIG = TOURNAMENT_CONFIG;
window.validateTournamentConfig = validateTournamentConfig;
window.getExpectedTournamentCount = getExpectedTournamentCount;
window.getTierConfig = getTierConfig;
window.getPrizeDistribution = getPrizeDistribution;
window.isAdminWallet = isAdminWallet;

// Auto-validate on load
document.addEventListener('DOMContentLoaded', function() {
    validateTournamentConfig();
    getExpectedTournamentCount();
});

console.log('✅ Tournament Configuration (Enhanced Tiered System) loaded!');
console.log('🎯 Bronze → Silver → Gold → Diamond progression');
console.log('📅 Tournaments deploy on Monday & Thursday at 14:00 UTC');
console.log('💰 Entry fees: 0.01, 0.05, 0.1, 0.25 SOL');