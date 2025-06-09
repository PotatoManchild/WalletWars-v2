// config.js - WalletWars Configuration
// This file stores all configuration settings for the platform

// API Keys
window.HELIUS_API_KEY = 'your-helius-api-key-here'; // Replace with your actual Helius API key

// Solana Configuration
window.SOLANA_NETWORK = 'devnet'; // Options: 'devnet', 'mainnet-beta', 'testnet'
window.SOLANA_RPC_URL = 'https://api.devnet.solana.com';

// Supabase Configuration (already in walletwars-api.js but good to centralize)
window.SUPABASE_URL = 'https://miwtcvcdpoqtqjbbvnxz.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pd3RjdmNkcG9xdHFqYmJ2bnh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3Mjk4MTAsImV4cCI6MjA2NDMwNTgxMH0.5FCUjucAu2PxGEVc3X01dwa4wt4tHLewsjBO7s55Zt8';

// Escrow Program Configuration
window.ESCROW_PROGRAM_ID = 'AXMwpemCzKXiozQhcMtxajPGQwiz4SWfb3xvH42RXuT7';
window.PLATFORM_WALLET = '5RLDuPHsa7ohaKUSNc5iYvtgveL1qrCcVdxVHXPeG3b8';

// Admin Configuration
window.ADMIN_WALLET = '6PoB9i9kpumDze7EhiL3CicAuEPxDAzrTVzHYot9sx9h';

// Feature Flags
window.FEATURES = {
    WALLET_SNAPSHOTS: true,        // Enable/disable wallet snapshots
    ESCROW_PAYMENTS: true,         // Enable/disable escrow payments
    AUTOMATED_TOURNAMENTS: true,   // Enable/disable automated tournament creation
    TRADING_VALIDATION: true       // Enable/disable trading style validation
};

// Tournament Configuration Defaults
window.TOURNAMENT_DEFAULTS = {
    MIN_PARTICIPANTS: 10,
    PLATFORM_FEE_PERCENTAGE: 10,
    PRIZE_POOL_PERCENTAGE: 85,
    REGISTRATION_LEAD_TIME: 3, // Days before tournament to open registration
    SNAPSHOT_INTERVAL: 300000  // 5 minutes in milliseconds
};

// API Rate Limits
window.API_LIMITS = {
    HELIUS_HOURLY: 100,
    HELIUS_DAILY: 1000,
    SOLSCAN_HOURLY: 50,
    SOLSCAN_DAILY: 500
};

// Development/Production Toggle
window.IS_DEVELOPMENT = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Logging Configuration
window.LOG_LEVEL = window.IS_DEVELOPMENT ? 'debug' : 'error';

// Initialize configuration
console.log('🔧 WalletWars Configuration Loaded');
console.log(`🌐 Network: ${window.SOLANA_NETWORK}`);
console.log(`🔑 Helius API: ${window.HELIUS_API_KEY ? 'Configured' : 'Not configured'}`);
console.log(`🏦 Escrow Program: ${window.ESCROW_PROGRAM_ID}`);
console.log(`👤 Admin Wallet: ${window.ADMIN_WALLET}`);
console.log(`🚀 Environment: ${window.IS_DEVELOPMENT ? 'Development' : 'Production'}`);

// Validate configuration
function validateConfig() {
    const issues = [];
    
    if (!window.HELIUS_API_KEY || window.HELIUS_API_KEY === 'your-helius-api-key-here') {
        issues.push('❌ Helius API key not configured');
    }
    
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        issues.push('❌ Supabase configuration missing');
    }
    
    if (issues.length > 0) {
        console.warn('⚠️ Configuration issues detected:');
        issues.forEach(issue => console.warn(issue));
    } else {
        console.log('✅ All configurations validated successfully');
    }
    
    return issues.length === 0;
}

// Run validation
window.CONFIG_VALID = validateConfig();

// Export for use
window.WalletWarsConfig = {
    HELIUS_API_KEY: window.HELIUS_API_KEY,
    SOLANA_NETWORK: window.SOLANA_NETWORK,
    SOLANA_RPC_URL: window.SOLANA_RPC_URL,
    ESCROW_PROGRAM_ID: window.ESCROW_PROGRAM_ID,
    PLATFORM_WALLET: window.PLATFORM_WALLET,
    ADMIN_WALLET: window.ADMIN_WALLET,
    FEATURES: window.FEATURES,
    validate: validateConfig
};