// tournament-test-mode.js
// TEST MODE Infrastructure for WalletWars Tournament System
// Allows safe development without blockchain interactions
// SAVE THIS FILE AS: tournament-test-mode.js

console.log('🧪 Loading Tournament Test Mode Infrastructure...');

class TournamentTestMode {
    constructor() {
        // Test mode configuration
        this.config = {
            enabled: true, // TEST MODE ON by default
            verbose: true, // Detailed logging
            simulateDelay: true, // Simulate blockchain delays
            delayMs: 1000, // Simulated transaction time
            
            // Special override for ONE real test
            allowOneRealTest: false,
            realTestUsed: false,
            realTestTournamentId: null,
            
            // Mock data storage
            mockTournaments: new Map(),
            mockRegistrations: new Map(),
            mockTransactions: [],
            
            // Counters for mock data
            mockTxCounter: 1000,
            mockPDACounter: 1000
        };
        
        // Load saved test mode state
        this.loadTestModeState();
        
        console.log(`✅ Test Mode Infrastructure initialized (${this.config.enabled ? 'ENABLED' : 'DISABLED'})`);
    }
    
    /**
     * Check if test mode is enabled
     */
    isEnabled() {
        return this.config.enabled;
    }
    
    /**
     * Enable test mode
     */
    enable() {
        this.config.enabled = true;
        this.saveTestModeState();
        console.log('🧪 TEST MODE: ENABLED');
        this.showTestModeWarning();
    }
    
    /**
     * Disable test mode (PRODUCTION MODE)
     */
    disable() {
        const confirm = window.confirm(
            '⚠️ WARNING: Disabling test mode will enable REAL blockchain transactions!\n\n' +
            'This will:\n' +
            '• Create real tournaments on-chain\n' +
            '• Require SOL for transactions\n' +
            '• Make irreversible changes\n\n' +
            'Are you SURE you want to switch to PRODUCTION MODE?'
        );
        
        if (confirm) {
            const doubleConfirm = window.confirm(
                '🚨 FINAL CONFIRMATION 🚨\n\n' +
                'You are about to enable PRODUCTION MODE.\n' +
                'Real SOL will be spent!\n\n' +
                'Type "PRODUCTION" to confirm:'
            );
            
            if (doubleConfirm) {
                const typed = window.prompt('Type "PRODUCTION" to confirm:');
                if (typed === 'PRODUCTION') {
                    this.config.enabled = false;
                    this.saveTestModeState();
                    console.log('🔴 TEST MODE: DISABLED - PRODUCTION MODE ACTIVE');
                    alert('⚠️ PRODUCTION MODE ACTIVE - Real transactions enabled!');
                } else {
                    console.log('❌ Production mode activation cancelled');
                }
            }
        }
    }
    
    /**
     * Show test mode warning banner
     */
    showTestModeWarning() {
        // Remove existing banner if any
        const existing = document.getElementById('testModeBanner');
        if (existing) existing.remove();
        
        // Create warning banner
        const banner = document.createElement('div');
        banner.id = 'testModeBanner';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(90deg, #f59e0b, #ef4444);
            color: white;
            padding: 10px;
            text-align: center;
            font-weight: bold;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        banner.innerHTML = `
            🧪 TEST MODE ACTIVE - No real blockchain transactions 
            <button onclick="window.tournamentTestMode.showTestPanel()" style="
                margin-left: 20px;
                padding: 5px 15px;
                background: rgba(255,255,255,0.2);
                border: 1px solid white;
                color: white;
                border-radius: 5px;
                cursor: pointer;
            ">Test Panel</button>
        `;
        
        document.body.appendChild(banner);
        
        // Adjust page content to account for banner
        document.body.style.paddingTop = '50px';
    }
    
    /**
     * Show test control panel
     */
    showTestPanel() {
        // Remove existing panel if any
        const existing = document.getElementById('testControlPanel');
        if (existing) {
            existing.remove();
            return;
        }
        
        const panel = document.createElement('div');
        panel.id = 'testControlPanel';
        panel.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            width: 350px;
            max-height: 80vh;
            background: rgba(31, 41, 55, 0.95);
            border: 2px solid #8b5cf6;
            border-radius: 10px;
            padding: 20px;
            z-index: 9999;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        `;
        
        panel.innerHTML = `
            <h3 style="color: #8b5cf6; margin-top: 0;">🧪 Test Mode Control Panel</h3>
            
            <div style="margin-bottom: 15px;">
                <h4 style="color: #06b6d4;">Status</h4>
                <p style="color: #10b981;">✅ Test Mode Active</p>
                <p style="color: #9ca3af; font-size: 0.9em;">
                    Mock Tournaments: ${this.config.mockTournaments.size}<br>
                    Mock Registrations: ${this.config.mockRegistrations.size}<br>
                    Mock Transactions: ${this.config.mockTransactions.length}
                </p>
            </div>
            
            <div style="margin-bottom: 15px;">
                <h4 style="color: #06b6d4;">Actions</h4>
                <button onclick="window.tournamentTestMode.clearMockData()" style="
                    width: 100%;
                    padding: 10px;
                    margin: 5px 0;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">Clear All Mock Data</button>
                
                <button onclick="window.tournamentTestMode.exportMockData()" style="
                    width: 100%;
                    padding: 10px;
                    margin: 5px 0;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">Export Mock Data</button>
                
                <button onclick="window.tournamentTestMode.toggleVerbose()" style="
                    width: 100%;
                    padding: 10px;
                    margin: 5px 0;
                    background: #8b5cf6;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">Toggle Verbose Logging</button>
            </div>
            
            <div style="margin-bottom: 15px;">
                <h4 style="color: #06b6d4;">One Real Test Override</h4>
                <p style="color: #9ca3af; font-size: 0.9em;">
                    Status: ${this.config.realTestUsed ? '✅ Used' : '⏳ Available'}<br>
                    ${this.config.realTestTournamentId ? `Tournament ID: ${this.config.realTestTournamentId}` : ''}
                </p>
                ${!this.config.realTestUsed ? `
                    <button onclick="window.tournamentTestMode.enableOneRealTest()" style="
                        width: 100%;
                        padding: 10px;
                        margin: 5px 0;
                        background: #f59e0b;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Enable ONE Real Test</button>
                ` : ''}
            </div>
            
            <div style="margin-bottom: 15px;">
                <h4 style="color: #06b6d4;">Recent Mock Transactions</h4>
                <div style="max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px;">
                    ${this.config.mockTransactions.slice(-5).reverse().map(tx => `
                        <div style="margin-bottom: 5px; font-size: 0.8em;">
                            <span style="color: #10b981;">TX ${tx.id}:</span>
                            <span style="color: #9ca3af;">${tx.type}</span>
                        </div>
                    `).join('') || '<p style="color: #6b7280;">No transactions yet</p>'}
                </div>
            </div>
            
            <button onclick="document.getElementById('testControlPanel').remove()" style="
                width: 100%;
                padding: 10px;
                background: #6b7280;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            ">Close Panel</button>
        `;
        
        document.body.appendChild(panel);
    }
    
    /**
     * Enable one real test override
     */
    enableOneRealTest() {
        if (this.config.realTestUsed) {
            alert('❌ One real test has already been used!');
            return;
        }
        
        const confirm = window.confirm(
            '⚠️ ONE REAL TEST OVERRIDE\n\n' +
            'This will allow the NEXT tournament creation to be REAL.\n' +
            'This will use real SOL and create on blockchain.\n\n' +
            'Are you sure?'
        );
        
        if (confirm) {
            this.config.allowOneRealTest = true;
            this.saveTestModeState();
            alert('✅ One real test enabled for NEXT tournament creation only');
            this.showTestPanel(); // Refresh panel
        }
    }
    
    /**
     * Mock tournament initialization
     */
    async mockInitializeTournament(tournamentData) {
        this.log('🎮 MOCK: Initializing tournament...', tournamentData);
        
        // Simulate delay
        if (this.config.simulateDelay) {
            await this.simulateBlockchainDelay();
        }
        
        // Generate mock PDAs
        const tournamentPDA = this.generateMockPDA('tournament', tournamentData.tournamentId);
        const escrowPDA = this.generateMockPDA('escrow', tournamentData.tournamentId);
        
        // Store mock tournament
        const mockTournament = {
            ...tournamentData,
            tournamentPDA,
            escrowPDA,
            createdAt: new Date().toISOString(),
            status: 'initialized',
            currentPlayers: 0,
            totalPrizePool: 0
        };
        
        this.config.mockTournaments.set(tournamentData.tournamentId, mockTournament);
        
        // Create mock transaction
        const mockTx = this.createMockTransaction('initializeTournament', {
            tournamentId: tournamentData.tournamentId,
            tournamentPDA,
            escrowPDA
        });
        
        this.log('✅ MOCK: Tournament initialized successfully', {
            signature: mockTx,
            tournamentPDA,
            escrowPDA
        });
        
        return {
            success: true,
            signature: mockTx,
            tournamentPDA,
            escrowPDA,
            mock: true
        };
    }
    
    /**
     * Mock player registration
     */
    async mockRegisterPlayer(tournamentId, playerWallet) {
        this.log('📝 MOCK: Registering player...', { tournamentId, player: playerWallet });
        
        // Check if tournament exists in mock data
        const tournament = this.config.mockTournaments.get(tournamentId);
        if (!tournament) {
            throw new Error('Mock tournament not found');
        }
        
        // Simulate delay
        if (this.config.simulateDelay) {
            await this.simulateBlockchainDelay();
        }
        
        // Generate mock registration PDA
        const registrationPDA = this.generateMockPDA('registration', `${tournamentId}_${playerWallet}`);
        
        // Store mock registration
        const registrationKey = `${tournamentId}_${playerWallet}`;
        if (this.config.mockRegistrations.has(registrationKey)) {
            throw new Error('Player already registered');
        }
        
        this.config.mockRegistrations.set(registrationKey, {
            tournamentId,
            playerWallet,
            registrationPDA,
            entryFeePaid: tournament.entryFee,
            registeredAt: new Date().toISOString()
        });
        
        // Update mock tournament
        tournament.currentPlayers++;
        tournament.totalPrizePool += tournament.entryFee;
        
        // Create mock transaction
        const mockTx = this.createMockTransaction('registerPlayer', {
            tournamentId,
            playerWallet,
            registrationPDA,
            entryFee: tournament.entryFee
        });
        
        this.log('✅ MOCK: Player registered successfully', {
            signature: mockTx,
            registrationPDA,
            entryFeePaid: tournament.entryFee
        });
        
        return {
            success: true,
            signature: mockTx,
            registrationPDA,
            entryFeePaid: tournament.entryFee,
            mock: true
        };
    }
    
    /**
     * Mock escrow balance check
     */
    async mockGetEscrowBalance(tournamentId) {
        this.log('💰 MOCK: Checking escrow balance...', { tournamentId });
        
        const tournament = this.config.mockTournaments.get(tournamentId);
        if (!tournament) {
            return {
                success: false,
                balance: 0,
                error: 'Mock tournament not found'
            };
        }
        
        // Simulate delay
        if (this.config.simulateDelay) {
            await this.simulateBlockchainDelay();
        }
        
        const balance = tournament.totalPrizePool || 0;
        
        this.log('✅ MOCK: Escrow balance retrieved', { balance });
        
        return {
            success: true,
            balance,
            escrowAddress: tournament.escrowPDA,
            mock: true
        };
    }
    
    /**
     * Generate mock PDA
     */
    generateMockPDA(type, seed) {
        const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let pda = `MOCK_${type}_${this.config.mockPDACounter++}_`;
        
        // Add some randomness
        for (let i = 0; i < 20; i++) {
            pda += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return pda;
    }
    
    /**
     * Create mock transaction
     */
    createMockTransaction(type, data) {
        const tx = {
            id: `MOCK_TX_${this.config.mockTxCounter++}`,
            type,
            data,
            timestamp: new Date().toISOString(),
            status: 'confirmed'
        };
        
        this.config.mockTransactions.push(tx);
        
        // Keep only last 100 transactions
        if (this.config.mockTransactions.length > 100) {
            this.config.mockTransactions.shift();
        }
        
        return tx.id;
    }
    
    /**
     * Simulate blockchain delay
     */
    async simulateBlockchainDelay() {
        await new Promise(resolve => setTimeout(resolve, this.config.delayMs));
    }
    
    /**
     * Clear all mock data
     */
    clearMockData() {
        const confirm = window.confirm('Clear all mock data? This cannot be undone.');
        
        if (confirm) {
            this.config.mockTournaments.clear();
            this.config.mockRegistrations.clear();
            this.config.mockTransactions = [];
            this.config.mockTxCounter = 1000;
            this.config.mockPDACounter = 1000;
            this.saveTestModeState();
            
            console.log('✅ All mock data cleared');
            alert('Mock data cleared successfully');
            this.showTestPanel(); // Refresh panel
        }
    }
    
    /**
     * Export mock data for debugging
     */
    exportMockData() {
        const data = {
            testMode: this.config.enabled,
            tournaments: Array.from(this.config.mockTournaments.entries()),
            registrations: Array.from(this.config.mockRegistrations.entries()),
            transactions: this.config.mockTransactions,
            stats: {
                tournamentsCreated: this.config.mockTournaments.size,
                registrationsProcessed: this.config.mockRegistrations.size,
                transactionsExecuted: this.config.mockTransactions.length
            }
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `walletwars_test_data_${Date.now()}.json`;
        a.click();
        
        console.log('✅ Mock data exported');
    }
    
    /**
     * Toggle verbose logging
     */
    toggleVerbose() {
        this.config.verbose = !this.config.verbose;
        this.saveTestModeState();
        console.log(`📢 Verbose logging: ${this.config.verbose ? 'ON' : 'OFF'}`);
        this.showTestPanel(); // Refresh panel
    }
    
    /**
     * Enhanced logging for test mode
     */
    log(message, data = null) {
        if (this.config.verbose) {
            console.log(`[TEST MODE] ${message}`);
            if (data) {
                console.log('  └─ Data:', data);
            }
        }
    }
    
    /**
     * Save test mode state to localStorage
     */
    saveTestModeState() {
        const state = {
            enabled: this.config.enabled,
            verbose: this.config.verbose,
            realTestUsed: this.config.realTestUsed,
            realTestTournamentId: this.config.realTestTournamentId
        };
        
        localStorage.setItem('walletwars_test_mode', JSON.stringify(state));
    }
    
    /**
     * Load test mode state from localStorage
     */
    loadTestModeState() {
        try {
            const saved = localStorage.getItem('walletwars_test_mode');
            if (saved) {
                const state = JSON.parse(saved);
                this.config.enabled = state.enabled !== false; // Default to true
                this.config.verbose = state.verbose !== false; // Default to true
                this.config.realTestUsed = state.realTestUsed || false;
                this.config.realTestTournamentId = state.realTestTournamentId || null;
            }
        } catch (error) {
            console.error('Failed to load test mode state:', error);
        }
    }
    
    /**
     * Check if should use real blockchain for this operation
     */
    shouldUseRealBlockchain() {
        // If test mode is disabled, always use real
        if (!this.config.enabled) {
            return true;
        }
        
        // Check for one real test override
        if (this.config.allowOneRealTest && !this.config.realTestUsed) {
            return true;
        }
        
        // Otherwise, use mock
        return false;
    }
    
    /**
     * Mark one real test as used
     */
    markRealTestUsed(tournamentId) {
        this.config.allowOneRealTest = false;
        this.config.realTestUsed = true;
        this.config.realTestTournamentId = tournamentId;
        this.saveTestModeState();
        
        console.log('🎯 One real test used for tournament:', tournamentId);
        alert(`✅ Real tournament created: ${tournamentId}\n\nTest mode will resume for future operations.`);
    }
}

// Create global instance
window.tournamentTestMode = new TournamentTestMode();

// Auto-show warning if test mode is enabled
if (window.tournamentTestMode.isEnabled()) {
    document.addEventListener('DOMContentLoaded', () => {
        window.tournamentTestMode.showTestModeWarning();
    });
}

// Export for use
window.TournamentTestMode = TournamentTestMode;

console.log('✅ Tournament Test Mode Infrastructure loaded!');
console.log('🧪 Test mode is:', window.tournamentTestMode.isEnabled() ? 'ENABLED' : 'DISABLED');
console.log('💡 Use window.tournamentTestMode.showTestPanel() to open control panel');