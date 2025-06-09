// global-wallet-manager.js
// Persistent wallet connection management across all pages

console.log('🔗 Loading Global Wallet Connection Manager...');

class GlobalWalletManager {
    constructor() {
        this.walletAdapter = null;
        this.connectedWallet = null;
        this.championData = {
            name: '',
            avatar: '🔥',
            wallet: '',
            walletType: '',
            championId: null,
            isConnected: false
        };
        
        this.storageKey = 'walletWars_wallet_connection';
        this.championKey = 'walletWars_champion_data';
        
        // Initialize on creation
        this.initializeWalletManager();
        
        console.log('✅ Global Wallet Manager initialized');
    }

    /**
     * Initialize wallet manager and restore previous connection
     */
    async initializeWalletManager() {
        try {
            console.log('🔍 Checking for existing wallet connection...');
            
            // Check for saved connection data
            const savedConnection = this.getSavedConnection();
            const savedChampion = this.getSavedChampion();
            
            if (savedConnection && savedChampion) {
                console.log(`🔄 Attempting to restore ${savedConnection.walletType} connection...`);
                
                // Try to reconnect to the wallet
                const reconnected = await this.attemptReconnection(savedConnection);
                
                if (reconnected) {
                    this.championData = savedChampion;
                    this.championData.isConnected = true;
                    this.updateAllPagesUI();
                    console.log('✅ Wallet connection restored successfully!');
                } else {
                    console.log('⚠️ Could not restore wallet connection, clearing saved data');
                    this.clearSavedData();
                }
            } else {
                console.log('ℹ️ No saved wallet connection found');
            }
            
        } catch (error) {
            console.error('❌ Error initializing wallet manager:', error);
            this.clearSavedData();
        }
    }

    /**
     * Connect to a specific wallet type
     */
    async connectWallet(walletType) {
        try {
            console.log(`🔗 Connecting to ${walletType} wallet...`);
            
            let adapter = null;
            
            switch (walletType) {
                case 'phantom':
                    if (window.solana && window.solana.isPhantom) {
                        adapter = window.solana;
                    } else {
                        throw new Error('Phantom wallet not found');
                    }
                    break;
                    
                case 'solflare':
                    if (window.solflare && window.solflare.isSolflare) {
                        adapter = window.solflare;
                    } else {
                        throw new Error('Solflare wallet not found');
                    }
                    break;
                    
                case 'backpack':
                    if (window.backpack) {
                        adapter = window.backpack;
                    } else {
                        throw new Error('Backpack wallet not found');
                    }
                    break;
                    
                case 'torus':
                    // Demo mode for Torus
                    console.log('🌀 Torus - using demo mode');
                    this.championData.wallet = this.generateFakeWalletAddress();
                    this.championData.walletType = walletType;
                    this.walletAdapter = { publicKey: { toString: () => this.championData.wallet } };
                    this.saveConnectionData();
                    return true;
                    
                default:
                    throw new Error(`Unsupported wallet type: ${walletType}`);
            }
            
            // Connect to the wallet
            const response = await adapter.connect();
            const publicKey = adapter.publicKey;
            
            if (!publicKey) {
                throw new Error('Failed to get wallet public key');
            }
            
            const walletAddress = publicKey.toString();
            console.log(`✅ Wallet connected: ${walletAddress.substring(0, 8)}...`);
            
            // Store connection data
            this.walletAdapter = adapter;
            this.connectedWallet = {
                adapter: adapter,
                publicKey: publicKey,
                address: walletAddress
            };
            
            this.championData.wallet = walletAddress;
            this.championData.walletType = walletType;
            this.championData.isConnected = true;
            
            // Save to localStorage for persistence
            this.saveConnectionData();
            
            // Set up wallet event listeners
            this.setupWalletEventListeners(adapter, walletType);
            
            return true;
            
        } catch (error) {
            console.error(`❌ Failed to connect to ${walletType}:`, error);
            throw error;
        }
    }

    /**
     * Disconnect wallet and clear all data
     */
    async disconnectWallet() {
        try {
            console.log('👋 Disconnecting wallet...');
            
            // Disconnect from wallet adapter
            if (this.walletAdapter && this.walletAdapter.disconnect) {
                try {
                    await this.walletAdapter.disconnect();
                } catch (error) {
                    console.warn('⚠️ Wallet disconnect warning:', error);
                }
            }
            
            // Clear all data
            this.walletAdapter = null;
            this.connectedWallet = null;
            this.championData = {
                name: '',
                avatar: '🔥',
                wallet: '',
                walletType: '',
                championId: null,
                isConnected: false
            };
            
            // Clear saved data
            this.clearSavedData();
            
            // Update all pages UI
            this.updateAllPagesUI();
            
            console.log('✅ Wallet disconnected successfully');
            
        } catch (error) {
            console.error('❌ Error disconnecting wallet:', error);
        }
    }

    /**
     * Set champion data after creation
     */
    setChampionData(championName, avatarEmoji, championId) {
        this.championData.name = championName;
        this.championData.avatar = avatarEmoji;
        this.championData.championId = championId;
        this.championData.isConnected = true;
        
        // Save updated data
        this.saveConnectionData();
        this.saveChampionData();
        
        // Update all pages
        this.updateAllPagesUI();
        
        console.log('✅ Champion data set and saved');
    }

    /**
     * Save connection data to localStorage
     */
    saveConnectionData() {
        const connectionData = {
            walletType: this.championData.walletType,
            walletAddress: this.championData.wallet,
            timestamp: Date.now(),
            isConnected: this.championData.isConnected
        };
        
        localStorage.setItem(this.storageKey, JSON.stringify(connectionData));
    }

    /**
     * Save champion data to localStorage
     */
    saveChampionData() {
        localStorage.setItem(this.championKey, JSON.stringify(this.championData));
    }

    /**
     * Get saved connection data
     */
    getSavedConnection() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('❌ Error reading saved connection:', error);
            return null;
        }
    }

    /**
     * Get saved champion data
     */
    getSavedChampion() {
        try {
            const saved = localStorage.getItem(this.championKey);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('❌ Error reading saved champion:', error);
            return null;
        }
    }

    /**
     * Clear all saved data
     */
    clearSavedData() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.championKey);
    }

    /**
     * Attempt to reconnect to a previously connected wallet
     */
    async attemptReconnection(savedConnection) {
        try {
            const { walletType, walletAddress } = savedConnection;
            
            // Check if the wallet is still available
            let adapter = null;
            
            switch (walletType) {
                case 'phantom':
                    if (window.solana && window.solana.isPhantom) {
                        adapter = window.solana;
                    }
                    break;
                case 'solflare':
                    if (window.solflare && window.solflare.isSolflare) {
                        adapter = window.solflare;
                    }
                    break;
                case 'backpack':
                    if (window.backpack) {
                        adapter = window.backpack;
                    }
                    break;
                case 'torus':
                    // Demo mode - always "reconnects"
                    this.championData.wallet = walletAddress;
                    this.championData.walletType = walletType;
                    this.walletAdapter = { publicKey: { toString: () => walletAddress } };
                    return true;
            }
            
            if (!adapter) {
                console.log(`⚠️ ${walletType} wallet not available for reconnection`);
                return false;
            }
            
            // Check if wallet is already connected
            if (adapter.isConnected) {
                const currentAddress = adapter.publicKey.toString();
                if (currentAddress === walletAddress) {
                    console.log(`✅ ${walletType} wallet already connected with same address`);
                    this.walletAdapter = adapter;
                    this.connectedWallet = {
                        adapter: adapter,
                        publicKey: adapter.publicKey,
                        address: currentAddress
                    };
                    this.setupWalletEventListeners(adapter, walletType);
                    return true;
                }
            }
            
            // Try to connect silently
            try {
                const response = await adapter.connect({ onlyIfTrusted: true });
                const currentAddress = adapter.publicKey.toString();
                
                if (currentAddress === walletAddress) {
                    console.log(`✅ ${walletType} wallet reconnected successfully`);
                    this.walletAdapter = adapter;
                    this.connectedWallet = {
                        adapter: adapter,
                        publicKey: adapter.publicKey,
                        address: currentAddress
                    };
                    this.setupWalletEventListeners(adapter, walletType);
                    return true;
                } else {
                    console.log(`⚠️ ${walletType} connected but with different address`);
                    return false;
                }
            } catch (error) {
                console.log(`⚠️ Silent reconnection failed for ${walletType}:`, error.message);
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error attempting reconnection:', error);
            return false;
        }
    }

    /**
     * Set up wallet event listeners for connection state changes
     */
    setupWalletEventListeners(adapter, walletType) {
        try {
            // Remove existing listeners first
            if (adapter.removeAllListeners) {
                adapter.removeAllListeners();
            }
            
            // Add disconnect listener
            adapter.on('disconnect', () => {
                console.log(`📱 ${walletType} wallet disconnected`);
                if (this.championData.walletType === walletType) {
                    this.handleUnexpectedDisconnection();
                }
            });
            
            // Add account change listener (if supported)
            if (adapter.on && typeof adapter.on === 'function') {
                adapter.on('accountChanged', (newAccount) => {
                    console.log(`📱 ${walletType} account changed:`, newAccount);
                    if (newAccount !== this.championData.wallet) {
                        this.handleAccountChange(newAccount);
                    }
                });
            }
            
        } catch (error) {
            console.warn('⚠️ Could not set up wallet event listeners:', error);
        }
    }

    /**
     * Handle unexpected wallet disconnection
     */
    handleUnexpectedDisconnection() {
        console.log('⚠️ Wallet disconnected unexpectedly');
        
        // Clear connection but ask user if they want to reconnect
        setTimeout(() => {
            if (this.championData.isConnected) {
                const shouldReconnect = confirm('⚠️ Wallet disconnected unexpectedly. Would you like to reconnect?');
                if (shouldReconnect) {
                    this.connectWallet(this.championData.walletType).catch(error => {
                        console.error('❌ Reconnection failed:', error);
                        this.disconnectWallet();
                    });
                } else {
                    this.disconnectWallet();
                }
            }
        }, 1000);
    }

    /**
     * Handle wallet account change
     */
    handleAccountChange(newAccount) {
        console.log('🔄 Wallet account changed');
        
        const shouldUpdate = confirm('🔄 Wallet account changed. Update WalletWars connection?');
        if (shouldUpdate) {
            this.championData.wallet = newAccount;
            this.saveConnectionData();
            this.updateAllPagesUI();
        } else {
            this.disconnectWallet();
        }
    }

    /**
     * Update UI on all pages to reflect connection state
     */
    updateAllPagesUI() {
        if (this.championData.isConnected) {
            this.updateToConnectedState();
        } else {
            this.updateToDisconnectedState();
        }
    }

    /**
     * Update UI to show connected state
     */
    updateToConnectedState() {
        // Update navigation
        const connectBtn = document.getElementById('connectWalletBtn');
        const championInfo = document.getElementById('championInfo');
        
        if (connectBtn) connectBtn.style.display = 'none';
        if (championInfo) {
            championInfo.style.display = 'flex';
            
            const avatar = document.getElementById('navChampionAvatar');
            const name = document.getElementById('navChampionName');
            
            if (avatar) avatar.textContent = this.championData.avatar;
            if (name) name.textContent = this.championData.name;
        }
        
        // Update hero section (if on home page)
        const heroDisconnected = document.getElementById('heroDisconnected');
        const heroConnected = document.getElementById('heroConnected');
        const heroChampionName = document.getElementById('heroChampionNameText');
        
        if (heroDisconnected) heroDisconnected.style.display = 'none';
        if (heroConnected) heroConnected.style.display = 'block';
        if (heroChampionName) heroChampionName.textContent = this.championData.name;
        
        console.log('✅ UI updated to connected state');
    }

    /**
     * Update UI to show disconnected state
     */
    updateToDisconnectedState() {
        // Update navigation
        const connectBtn = document.getElementById('connectWalletBtn');
        const championInfo = document.getElementById('championInfo');
        
        if (connectBtn) connectBtn.style.display = 'block';
        if (championInfo) championInfo.style.display = 'none';
        
        // Update hero section (if on home page)
        const heroDisconnected = document.getElementById('heroDisconnected');
        const heroConnected = document.getElementById('heroConnected');
        
        if (heroDisconnected) heroDisconnected.style.display = 'block';
        if (heroConnected) heroConnected.style.display = 'none';
        
        console.log('✅ UI updated to disconnected state');
    }

    /**
     * Get current connection status
     */
    getConnectionStatus() {
        return {
            isConnected: this.championData.isConnected,
            walletType: this.championData.walletType,
            walletAddress: this.championData.wallet,
            championName: this.championData.name,
            championId: this.championData.championId,
            avatar: this.championData.avatar
        };
    }

    /**
     * Check if wallet is available
     */
    isWalletAvailable(walletType) {
        switch (walletType) {
            case 'phantom':
                return !!(window.solana && window.solana.isPhantom);
            case 'solflare':
                return !!(window.solflare && window.solflare.isSolflare);
            case 'backpack':
                return !!window.backpack;
            case 'torus':
                return true; // Always available in demo mode
            default:
                return false;
        }
    }

    /**
     * Generate fake wallet address for demo
     */
    generateFakeWalletAddress() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
        let result = '';
        for (let i = 0; i < 44; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

// Create global instance
window.globalWalletManager = new GlobalWalletManager();

// Export for use in other scripts
window.connectWallet = async (walletType) => {
    return await window.globalWalletManager.connectWallet(walletType);
};

window.disconnectWallet = async () => {
    return await window.globalWalletManager.disconnectWallet();
};

window.getWalletStatus = () => {
    return window.globalWalletManager.getConnectionStatus();
};

console.log('✅ Global Wallet Manager loaded and ready!');