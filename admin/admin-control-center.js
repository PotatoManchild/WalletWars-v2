// admin-control-center.js
// WalletWars Admin Control Center JavaScript
// Updated: Fixed transaction broadcasting issues with retry logic

// Global state
let currentConfig = {};
let deploymentManager = null;
let escrowIntegration = null;
let isDirty = false;
let adminWallet = null;

// HTML escape function to prevent code bleeding
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Persistence helper class
class ConfigPersistence {
    static async saveToDatabase(config) {
        try {
            const { error } = await window.walletWarsAPI.supabase
                .from('admin_config')
                .upsert({
                    key: 'tournament_config',
                    value: config,
                    updated_by: window.adminAuth?.getCurrentWallet ? window.adminAuth.getCurrentWallet() : 'admin',
                    updated_at: new Date().toISOString()
                });
                
            if (error) throw error;
            console.log('✅ Configuration saved to database');
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to save configuration:', error);
            return { success: false, error: error.message };
        }
    }
    
    static async loadFromDatabase() {
        try {
            const { data, error } = await window.walletWarsAPI.supabase
                .from('admin_config')
                .select('value')
                .eq('key', 'tournament_config')
                .single();
                
            if (error) {
                if (error.code === 'PGRST116') {
                    console.log('📋 No saved configuration found, using defaults');
                    return null;
                }
                throw error;
            }
            
            console.log('✅ Configuration loaded from database');
            return data.value;
        } catch (error) {
            console.error('❌ Failed to load configuration:', error);
            return null;
        }
    }
}

// Toast notification system
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    }[type];
    
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toast.onclick = () => toast.remove();
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Alias for compatibility
function showAlert(message, type) {
    showToast(message, type);
}

// Mobile menu toggle
function toggleMobileMenu() {
    const nav = document.querySelector('.tab-navigation');
    const overlay = document.querySelector('.mobile-overlay');
    
    nav.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
}

// Tab switching function
function switchTab(tabName, buttonElement) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Mark button as active
    if (buttonElement) {
        buttonElement.classList.add('active');
    }

    // Close mobile menu
    const nav = document.querySelector('.tab-navigation');
    const overlay = document.querySelector('.mobile-overlay');
    nav.classList.remove('mobile-open');
    overlay.classList.remove('active');

    // Refresh data for specific tabs
    if (tabName === 'monitoring') {
        loadMonitoringData();
    } else if (tabName === 'deployment') {
        updateSchedulePreview();
    } else if (tabName === 'history') {
        loadDeploymentHistory();
    } else if (tabName === 'variants') {
        loadVariants();
    }
}

// Initialize escrow integration with enhanced error handling
async function initializeEscrow() {
    if (!adminWallet) {
        console.error('❌ No admin wallet connected');
        updateStatus('escrowStatus', false);
        return false;
    }

    try {
        if (!window.WalletWarsEscrowIntegration) {
            console.error('❌ Escrow integration script not loaded');
            updateStatus('escrowStatus', false);
            return false;
        }

        console.log('🔐 Initializing escrow with wallet:', adminWallet.publicKey?.toString());
        escrowIntegration = new window.WalletWarsEscrowIntegration(adminWallet);
        
        // Test connection
        const testResult = await escrowIntegration.testConnection();
        if (testResult.success) {
            console.log('✅ Escrow integration initialized');
            updateStatus('escrowStatus', true);
            return true;
        } else {
            console.error('❌ Escrow test failed:', testResult.error);
            updateStatus('escrowStatus', false);
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to initialize escrow:', error);
        updateStatus('escrowStatus', false);
        return false;
    }
}

// Test escrow connection
async function testEscrowConnection() {
    const container = document.getElementById('testResults');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div> Testing escrow connection...';
    
    try {
        if (!escrowIntegration) {
            const initialized = await initializeEscrow();
            if (!initialized) {
                container.innerHTML = `
                    <div class="alert alert-error">
                        ❌ Failed to initialize escrow integration. Make sure wallet is connected.
                    </div>
                `;
                return;
            }
        }
        
        const result = await escrowIntegration.testConnection();
        
        if (result.success) {
            container.innerHTML = `
                <div class="alert alert-success">
                    ✅ Escrow connection successful!<br>
                    Program ID: ${escrowIntegration.PROGRAM_ID.toString()}<br>
                    Platform Wallet: ${escrowIntegration.PLATFORM_WALLET.toString()}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="alert alert-error">
                    ❌ Escrow connection failed: ${result.error || 'Unknown error'}
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `
            <div class="alert alert-error">
                ❌ Error testing escrow: ${error.message}
            </div>
        `;
    }
}

// Show deployment options modal
function showDeploymentOptions() {
    document.getElementById('deploymentOptionsModal').style.display = 'flex';
    
    // Update info based on selected option
    const radioButtons = document.querySelectorAll('input[name="deploymentType"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', updateDeploymentInfo);
    });
    
    updateDeploymentInfo();
}

// Close deployment options modal
function closeDeploymentOptions() {
    document.getElementById('deploymentOptionsModal').style.display = 'none';
}

// Update deployment info based on selection
function updateDeploymentInfo() {
    const selectedType = document.querySelector('input[name="deploymentType"]:checked').value;
    const infoDiv = document.getElementById('deploymentInfo');
    const deployButton = document.getElementById('deployButtonText');
    
    if (selectedType === 'onchain') {
        infoDiv.className = 'alert alert-warning';
        infoDiv.innerHTML = `
            <strong>On-Chain Deployment:</strong> Tournaments will be created on Solana blockchain. 
            This will require SOL for transaction fees and create permanent on-chain records.
            ${window.tournamentTestMode?.isEnabled() ? '<br><br>🧪 <strong>TEST MODE:</strong> Transactions will be simulated.' : ''}
        `;
        deployButton.textContent = 'Deploy On-Chain';
    } else {
        infoDiv.className = 'alert alert-info';
        infoDiv.innerHTML = `
            <strong>Database Only:</strong> Tournaments will be created in the database for testing. 
            No SOL will be spent and no blockchain transactions will occur.
        `;
        deployButton.textContent = 'Deploy to Database';
    }
}

// Deploy with selected option
async function deployWithSelectedOption() {
    const selectedType = document.querySelector('input[name="deploymentType"]:checked').value;
    closeDeploymentOptions();
    
    if (selectedType === 'onchain') {
        await deployTournamentsOnChain();
    } else {
        await deployTournamentsDatabaseOnly();
    }
}

// Enhanced tournament deployment manager for on-chain deployment
class EnhancedTournamentDeploymentManager {
    constructor() {
        this.escrowIntegration = null;
    }
    
    async initializeEscrow(wallet) {
        if (!this.escrowIntegration && wallet) {
            this.escrowIntegration = new window.WalletWarsEscrowIntegration(wallet);
            const testResult = await this.escrowIntegration.testConnection();
            return testResult.success;
        }
        return !!this.escrowIntegration;
    }
    
    async createTournamentWithEscrow(startDate, variant) {
        if (!this.escrowIntegration) {
            throw new Error('Escrow integration not initialized');
        }
        
        const tournamentId = `${variant.name.replace(/\s+/g, '_')}_${Date.now()}`;
        
        try {
            // Create tournament on-chain using the escrow integration
            const onChainResult = await this.escrowIntegration.initializeTournament({
                tournamentId,
                entryFee: variant.entryFee,
                maxPlayers: variant.maxParticipants,
                platformFeePercentage: currentConfig.escrow?.platformFeePercentage || 10,
                startTime: Math.floor(startDate.getTime() / 1000),
                endTime: Math.floor(startDate.getTime() / 1000) + (variant.duration * 24 * 60 * 60)
            });
            
            if (!onChainResult.success) {
                throw new Error(onChainResult.error || 'Failed to create tournament on-chain');
            }
            
            // If successful, create database record with on-chain data
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + variant.duration);
            
            const registrationStart = new Date(startDate);
            registrationStart.setDate(registrationStart.getDate() - 3);
            
            const tournamentData = {
                tournament_name: `${variant.name} - ${startDate.toLocaleDateString()}`,
                entry_fee: variant.entryFee,
                max_participants: variant.maxParticipants,
                registration_opens: registrationStart.toISOString(),
                registration_closes: startDate.toISOString(),
                start_time: startDate.toISOString(),
                end_time: endDate.toISOString(),
                trading_style: variant.tradingStyle,
                status: 'upcoming',
                on_chain_status: 'initialized',
                tournament_pda: onChainResult.tournamentPDA,
                escrow_pda: onChainResult.escrowPDA,
                init_tx_signature: onChainResult.signature,
                deployment_metadata: {
                    tournamentId: tournamentId,
                    tournamentPDA: onChainResult.tournamentPDA,
                    escrowPDA: onChainResult.escrowPDA,
                    deployedAt: new Date().toISOString(),
                    deployedBy: adminWallet.publicKey.toString()
                }
            };
            
            const { data, error } = await window.walletWarsAPI.supabase
                .from('tournament_instances')
                .insert(tournamentData)
                .select()
                .single();
                
            if (error) throw error;
            
            return data;
            
        } catch (error) {
            console.error('Failed to create tournament with escrow:', error);
            throw error;
        }
    }
}

// Deploy tournaments on-chain with fixed transaction handling
async function deployTournamentsOnChain() {
    if (!confirm('Deploy tournaments on-chain? This will create blockchain transactions.')) {
        return;
    }
    
    showAlert('Initializing on-chain deployment...', 'info');
    
    try {
        // Check wallet connection first
        if (!adminWallet || !window.phantom?.solana?.isConnected) {
            showAlert('Please connect your wallet first!', 'error');
            await checkConnections();
            return;
        }
        
        // Initialize deployment manager if needed
        if (!deploymentManager) {
            deploymentManager = new EnhancedTournamentDeploymentManager();
        }
        
        // Initialize escrow if needed
        if (!deploymentManager.escrowIntegration) {
            console.log('🔐 Initializing escrow for deployment manager...');
            const initialized = await deploymentManager.initializeEscrow(adminWallet);
            if (!initialized) {
                showAlert('Failed to initialize escrow integration. Make sure your wallet is connected.', 'error');
                await checkConnections();
                return;
            }
        }
        
        // Get enabled variants
        const enabledVariants = currentConfig.tournamentVariants.filter(v => v.enabled !== false);
        
        if (enabledVariants.length === 0) {
            showAlert('No enabled variants to deploy!', 'error');
            return;
        }
        
        // Create tournaments with escrow
        const deploymentDate = new Date();
        const deploymentResults = [];
        
        for (const variant of enabledVariants) {
            try {
                showAlert(`Deploying ${variant.name}...`, 'info');
                
                // Calculate start date (e.g., 7 days from now)
                const startDate = new Date(deploymentDate);
                startDate.setDate(startDate.getDate() + 7);
                
                // Deploy with escrow - now with proper transaction handling
                const result = await deploymentManager.createTournamentWithEscrow(startDate, variant);
                
                if (result) {
                    deploymentResults.push({
                        success: true,
                        variant: variant.name,
                        tournamentId: result.id,
                        onChain: true,
                        tournamentPDA: result.deployment_metadata?.tournamentPDA,
                        escrowPDA: result.deployment_metadata?.escrowPDA
                    });
                } else {
                    deploymentResults.push({
                        success: false,
                        variant: variant.name,
                        error: 'Deployment failed'
                    });
                }
            } catch (error) {
                console.error(`Failed to deploy ${variant.name}:`, error);
                deploymentResults.push({
                    success: false,
                    variant: variant.name,
                    error: error.message
                });
            }
        }
        
        // Log deployment
        await logDeployment(deploymentResults, 'onchain');
        
        // Show results
        const successCount = deploymentResults.filter(r => r.success).length;
        const failCount = deploymentResults.filter(r => !r.success).length;
        
        if (successCount > 0 && failCount === 0) {
            showAlert(`Successfully deployed ${successCount} tournaments on-chain!`, 'success');
        } else if (successCount > 0 && failCount > 0) {
            showAlert(`Deployed ${successCount} tournaments, ${failCount} failed.`, 'warning');
        } else {
            showAlert('Failed to deploy tournaments. Check console for details.', 'error');
        }
        
        // Refresh monitoring
        if (document.getElementById('monitoring-tab').classList.contains('active')) {
            loadMonitoringData();
        }
        
    } catch (error) {
        console.error('Deployment error:', error);
        showAlert('Failed to deploy tournaments: ' + error.message, 'error');
    }
}

// Deploy tournaments database only
async function deployTournamentsDatabaseOnly() {
    if (!confirm('Deploy tournaments to database only?')) {
        return;
    }
    
    showAlert('Deploying tournaments (database only)...', 'info');
    
    try {
        // Get enabled variants
        const enabledVariants = currentConfig.tournamentVariants.filter(v => v.enabled !== false);
        
        if (enabledVariants.length === 0) {
            showAlert('No enabled variants to deploy!', 'error');
            return;
        }
        
        // Create tournament instances
        const deploymentDate = new Date();
        const deploymentResults = [];
        
        for (const variant of enabledVariants) {
            try {
                // Calculate dates
                const registrationStart = new Date(deploymentDate);
                registrationStart.setDate(registrationStart.getDate() + 3);
                
                const startDate = new Date(registrationStart);
                startDate.setDate(startDate.getDate() + 4);
                
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + variant.duration);
                
                // Create tournament
                const tournament = {
                    tournament_name: `${variant.name} - ${startDate.toLocaleDateString()}`,
                    entry_fee: variant.entryFee,
                    max_participants: variant.maxParticipants,
                    registration_opens: registrationStart.toISOString(),
                    registration_closes: startDate.toISOString(),
                    start_time: startDate.toISOString(),
                    end_time: endDate.toISOString(),
                    trading_style: variant.tradingStyle,
                    prize_pool_percentage: variant.prizePoolPercentage,
                    platform_fee_percentage: currentConfig.escrow.platformFeePercentage,
                    status: 'upcoming',
                    on_chain_status: 'not_initialized',
                    deployed_at: deploymentDate.toISOString(),
                    deployed_by: window.adminAuth?.getCurrentWallet ? window.adminAuth.getCurrentWallet() : 'admin'
                };
                
                // Insert into database
                const { data, error } = await window.walletWarsAPI.supabase
                    .from('tournament_instances')
                    .insert(tournament)
                    .select()
                    .single();
                    
                if (error) throw error;
                
                deploymentResults.push({
                    success: true,
                    variant: variant.name,
                    tournamentId: data.id,
                    onChain: false
                });
                
            } catch (error) {
                console.error(`Failed to deploy ${variant.name}:`, error);
                deploymentResults.push({
                    success: false,
                    variant: variant.name,
                    error: error.message
                });
            }
        }
        
        // Log deployment
        await logDeployment(deploymentResults, 'database');
        
        // Show results
        const successCount = deploymentResults.filter(r => r.success).length;
        const failCount = deploymentResults.filter(r => !r.success).length;
        
        if (successCount > 0 && failCount === 0) {
            showAlert(`Successfully deployed ${successCount} tournaments!`, 'success');
        } else if (successCount > 0 && failCount > 0) {
            showAlert(`Deployed ${successCount} tournaments, ${failCount} failed.`, 'warning');
        } else {
            showAlert('Failed to deploy tournaments. Check console for details.', 'error');
        }
        
        // Refresh monitoring
        if (document.getElementById('monitoring-tab').classList.contains('active')) {
            loadMonitoringData();
        }
        
    } catch (error) {
        console.error('Database deployment error:', error);
        showAlert('Failed to deploy tournaments: ' + error.message, 'error');
    }
}

// Log deployment to admin_logs
async function logDeployment(results, deploymentType = 'database') {
    try {
        const logEntry = {
            action: deploymentType === 'onchain' ? 'onchain_deployment' : 'manual_deployment',
            admin_wallet: window.adminAuth?.getCurrentWallet ? window.adminAuth.getCurrentWallet() : 'admin',
            details: {
                timestamp: new Date().toISOString(),
                deployment_type: deploymentType,
                results: results,
                config_snapshot: {
                    variants: currentConfig.tournamentVariants.filter(v => v.enabled !== false),
                    platformFee: currentConfig.escrow?.platformFeePercentage || 10,
                    testMode: window.tournamentTestMode?.isEnabled() || false
                }
            }
        };
        
        const { error } = await window.walletWarsAPI.supabase
            .from('admin_logs')
            .insert(logEntry);
            
        if (error) {
            console.warn('⚠️ Failed to log deployment to admin_logs:', error);
        } else {
            console.log('✅ Deployment logged to admin_logs');
        }
            
    } catch (error) {
        console.error('Failed to log deployment:', error);
    }
}

// Load current configuration
function loadCurrentConfig() {
    if (window.TOURNAMENT_CONFIG) {
        currentConfig = JSON.parse(JSON.stringify(window.TOURNAMENT_CONFIG));
        
        // Populate form fields
        document.getElementById('platformFee').value = currentConfig.escrow?.platformFeePercentage || 10;
        document.getElementById('prizePool').value = currentConfig.weeklyTiers?.bronze?.prizePoolPercentage || 85;
        document.getElementById('registrationLead').value = 3;
        
        // Update test mode toggle
        const isTestMode = window.tournamentTestMode && window.tournamentTestMode.isEnabled();
        updateTestModeUI(isTestMode);
    }
}

// Check connections with enhanced wallet detection
async function checkConnections() {
    // Check wallet
    const walletConnected = window.phantom?.solana?.isConnected || false;
    updateStatus('walletStatus', walletConnected);
    document.getElementById('walletText').textContent = walletConnected ? 'Connected' : 'Not Connected';
    
    // Store admin wallet if connected
    if (walletConnected && window.phantom?.solana) {
        adminWallet = window.phantom.solana;
        console.log('✅ Admin wallet stored:', adminWallet.publicKey?.toString());
        
        // Try to initialize escrow immediately
        await initializeEscrow();
    } else {
        adminWallet = null;
        console.log('❌ No wallet connected');
        updateStatus('escrowStatus', false);
    }
    
    // Check database
    if (window.walletWarsAPI) {
        try {
            const dbConnected = await window.walletWarsAPI.testConnection();
            updateStatus('dbStatus', dbConnected);
        } catch (error) {
            updateStatus('dbStatus', false);
        }
    }
    
    // Check test mode
    const isTestMode = window.tournamentTestMode && window.tournamentTestMode.isEnabled();
    updateStatus('testModeStatus', !isTestMode);
    document.getElementById('testModeText').textContent = isTestMode ? 'Test Mode' : 'Production';
}

// Update status indicator
function updateStatus(elementId, isActive) {
    const element = document.getElementById(elementId);
    if (element) {
        if (isActive) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }
    }
}

// Toggle test mode
function toggleTestMode() {
    const toggle = document.getElementById('testModeToggle');
    const isActive = toggle.classList.contains('active');
    
    if (!isActive) {
        // Enable test mode
        if (window.tournamentTestMode) {
            window.tournamentTestMode.enable();
        }
        updateTestModeUI(true);
    } else {
        // Disable test mode
        if (window.tournamentTestMode) {
            window.tournamentTestMode.disable();
        }
        updateTestModeUI(false);
    }
    
    checkConnections();
}

// Update test mode UI
function updateTestModeUI(isEnabled) {
    const toggle = document.getElementById('testModeToggle');
    const label = document.getElementById('testModeLabel');
    
    if (toggle && label) {
        if (isEnabled) {
            toggle.classList.add('active');
            label.textContent = 'Enabled';
        } else {
            toggle.classList.remove('active');
            label.textContent = 'Disabled';
        }
    }
}

// Save global configuration
async function saveGlobalConfig() {
    const platformFee = parseInt(document.getElementById('platformFee').value);
    const prizePool = parseInt(document.getElementById('prizePool').value);
    const registrationLead = parseInt(document.getElementById('registrationLead').value);
    
    // Update configuration
    currentConfig.escrow = currentConfig.escrow || {};
    currentConfig.escrow.platformFeePercentage = platformFee;
    
    // Update all tiers with new prize pool
    if (currentConfig.weeklyTiers) {
        Object.keys(currentConfig.weeklyTiers).forEach(tier => {
            currentConfig.weeklyTiers[tier].prizePoolPercentage = prizePool;
        });
    }
    
    // Update tournament variants
    if (currentConfig.tournamentVariants) {
        currentConfig.tournamentVariants.forEach(variant => {
            variant.prizePoolPercentage = prizePool;
        });
    }
    
    // Apply to window config
    window.TOURNAMENT_CONFIG = currentConfig;
    
    // Save to database
    const result = await ConfigPersistence.saveToDatabase(currentConfig);
    
    if (result.success) {
        showAlert('Configuration saved successfully!', 'success');
        isDirty = false;
    } else {
        showAlert('Configuration saved locally but failed to save to database: ' + result.error, 'warning');
    }
}

// Reset global configuration
function resetGlobalConfig() {
    if (confirm('Reset all configuration to defaults? This will reload the page.')) {
        location.reload();
    }
}

// Load tournament variants
function loadVariants() {
    const container = document.getElementById('variantsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (currentConfig && currentConfig.tournamentVariants) {
        currentConfig.tournamentVariants.forEach((variant, index) => {
            const variantCard = createVariantCard(variant, index);
            container.appendChild(variantCard);
        });
    }
}

// Create variant card
function createVariantCard(variant, index) {
    const card = document.createElement('div');
    card.className = 'variant-card';
    card.innerHTML = `
        <div class="variant-header">
            <h3 class="variant-name">${escapeHtml(variant.name)}</h3>
            <div class="variant-actions">
                <button class="btn btn-danger btn-small" onclick="deleteVariant(${index})">
                    🗑️ Delete
                </button>
                <div class="toggle-group">
                    <div class="toggle-switch ${variant.enabled !== false ? 'active' : ''}" 
                         onclick="toggleVariant(${index})"></div>
                </div>
            </div>
        </div>
        <div class="variant-details">
            <div class="detail-item">
                <span class="detail-label">Entry Fee</span>
                <span class="detail-value">${variant.entryFee} SOL</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Max Players</span>
                <input type="number" class="control-input" value="${variant.maxParticipants}" 
                       min="10" max="1000" onchange="updateVariantCapacity(${index}, this.value)">
            </div>
            <div class="detail-item">
                <span class="detail-label">Trading Style</span>
                <span class="detail-value">${escapeHtml(variant.tradingStyle.replace('_', ' ').toUpperCase())}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Duration</span>
                <span class="detail-value">${variant.duration} days</span>
            </div>
        </div>
    `;
    return card;
}

// Toggle variant
function toggleVariant(index) {
    if (currentConfig.tournamentVariants && currentConfig.tournamentVariants[index]) {
        const variant = currentConfig.tournamentVariants[index];
        variant.enabled = variant.enabled === false ? true : false;
        loadVariants();
        isDirty = true;
        
        // Auto-save variant changes
        saveVariantChanges();
    }
}

// Delete variant
async function deleteVariant(index) {
    const variant = currentConfig.tournamentVariants[index];
    if (!confirm(`Delete variant "${variant.name}"? This action cannot be undone.`)) {
        return;
    }
    
    // Remove from array
    currentConfig.tournamentVariants.splice(index, 1);
    
    // Reload UI
    loadVariants();
    
    // Save changes
    await saveVariantChanges();
    showAlert(`Variant "${variant.name}" deleted successfully!`, 'success');
}

// Update variant capacity
function updateVariantCapacity(index, value) {
    if (currentConfig.tournamentVariants && currentConfig.tournamentVariants[index]) {
        currentConfig.tournamentVariants[index].maxParticipants = parseInt(value);
        isDirty = true;
        
        // Debounce auto-save (wait 1 second after typing stops)
        clearTimeout(window.capacitySaveTimeout);
        window.capacitySaveTimeout = setTimeout(() => {
            saveVariantChanges();
        }, 1000);
    }
}

// Save variant changes
async function saveVariantChanges() {
    // Apply to window config
    window.TOURNAMENT_CONFIG = currentConfig;
    
    // Save to database
    const result = await ConfigPersistence.saveToDatabase(currentConfig);
    
    if (result.success) {
        showAlert('Tournament variants saved!', 'success');
        isDirty = false;
    } else {
        showAlert('Failed to save variants to database: ' + result.error, 'error');
    }
}

// Filter variants
function filterVariants(filter) {
    const cards = document.querySelectorAll('.variant-card');
    cards.forEach(card => {
        const nameElement = card.querySelector('.variant-name');
        if (!nameElement) return;
        
        const name = nameElement.textContent.toLowerCase();
        if (filter === 'all') {
            card.style.display = 'block';
        } else if (filter === 'pure_wallet' && name.includes('pure wallet')) {
            card.style.display = 'block';
        } else if (filter === 'bronze' && name.includes('bronze')) {
            card.style.display = 'block';
        } else if (filter === 'silver' && name.includes('silver')) {
            card.style.display = 'block';
        } else if (filter === 'gold' && name.includes('gold')) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Show add variant modal
function showAddVariantModal() {
    document.getElementById('addVariantModal').style.display = 'flex';
    // Pre-fill prize pool percentage
    const prizePool = document.getElementById('prizePool').value;
    // Focus on name field
    setTimeout(() => {
        document.getElementById('newVariantName').focus();
    }, 100);
}

// Close add variant modal
function closeAddVariantModal() {
    document.getElementById('addVariantModal').style.display = 'none';
    // Clear form
    document.getElementById('newVariantName').value = '';
    document.getElementById('newVariantEntryFee').value = '';
    document.getElementById('newVariantMaxParticipants').value = '';
    document.getElementById('newVariantTradingStyle').value = 'pure_wallet';
    document.getElementById('newVariantDuration').value = '7';
    document.getElementById('newVariantEnabled').classList.add('active');
}

// Add new variant
async function addNewVariant() {
    const name = document.getElementById('newVariantName').value.trim();
    const entryFee = parseFloat(document.getElementById('newVariantEntryFee').value);
    const maxParticipants = parseInt(document.getElementById('newVariantMaxParticipants').value);
    const tradingStyle = document.getElementById('newVariantTradingStyle').value;
    const duration = parseInt(document.getElementById('newVariantDuration').value);
    const enabled = document.getElementById('newVariantEnabled').classList.contains('active');
    
    // Validation
    if (!name) {
        showAlert('Please enter a variant name', 'error');
        return;
    }
    
    if (!entryFee || entryFee <= 0) {
        showAlert('Please enter a valid entry fee', 'error');
        return;
    }
    
    if (!maxParticipants || maxParticipants < 10) {
        showAlert('Max participants must be at least 10', 'error');
        return;
    }
    
    // Create new variant
    const newVariant = {
        name: name,
        enabled: enabled,
        duration: duration,
        entryFee: entryFee,
        tradingStyle: tradingStyle,
        maxParticipants: maxParticipants,
        prizePoolPercentage: parseInt(document.getElementById('prizePool').value)
    };
    
    // Add to configuration
    if (!currentConfig.tournamentVariants) {
        currentConfig.tournamentVariants = [];
    }
    currentConfig.tournamentVariants.push(newVariant);
    
    // Save and reload
    await saveVariantChanges();
    loadVariants();
    closeAddVariantModal();
    
    showAlert(`Variant "${name}" added successfully!`, 'success');
}

// Save deployment schedule
async function saveDeploymentSchedule() {
    // Get selected days
    const days = [];
    if (document.getElementById('deployMonday').checked) days.push('monday');
    if (document.getElementById('deployTuesday').checked) days.push('tuesday');
    if (document.getElementById('deployWednesday').checked) days.push('wednesday');
    if (document.getElementById('deployThursday').checked) days.push('thursday');
    if (document.getElementById('deployFriday').checked) days.push('friday');
    
    const time = document.getElementById('deploymentTime').value + ':00';
    const advanceDays = parseInt(document.getElementById('advanceDays').value);
    const maxPerDate = parseInt(document.getElementById('tournamentsPerDay').value);
    
    // Update configuration
    currentConfig.deploymentDays = days;
    currentConfig.deploymentTime = time;
    currentConfig.timing = currentConfig.timing || {};
    currentConfig.timing.advanceDeploymentDays = advanceDays;
    currentConfig.timing.maxTournamentsPerDate = maxPerDate;
    
    // Apply to window config
    window.TOURNAMENT_CONFIG = currentConfig;
    
    // Save to database
    const result = await ConfigPersistence.saveToDatabase(currentConfig);
    
    if (result.success) {
        showAlert('Deployment schedule saved!', 'success');
        isDirty = false;
    } else {
        showAlert('Schedule saved locally but failed to save to database: ' + result.error, 'warning');
    }
}

// Create test tournament
async function createTestTournament() {
    if (!escrowIntegration) {
        showAlert('Escrow integration not initialized', 'error');
        return;
    }
    
    showAlert('Creating test tournament...', 'info');
    
    try {
        const result = await escrowIntegration.initializeTournament({
            tournamentId: `test_${Date.now()}`,
            entryFee: 0.01,
            maxPlayers: 10,
            platformFeePercentage: 10,
            startTime: Math.floor(Date.now() / 1000) + 3600,
            endTime: Math.floor(Date.now() / 1000) + 86400
        });
        
        if (result.success) {
            showAlert('Test tournament created successfully!', 'success');
            console.log('Test tournament result:', result);
        } else {
            showAlert('Failed to create test tournament: ' + result.error, 'error');
        }
    } catch (error) {
        showAlert(`Error: ${error.message}`, 'error');
    }
}

// Preview next deployment
async function previewNextDeployment() {
    const container = document.getElementById('testResults');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div> Calculating next deployment...';
    
    // Get next deployment dates
    const dates = getUpcomingDeploymentDates();
    const enabledVariants = currentConfig.tournamentVariants ? 
        currentConfig.tournamentVariants.filter(v => v.enabled !== false) : [];
    
    container.innerHTML = `
        <div class="preview-section">
            <h3 class="preview-title">Next Deployment Preview</h3>
            <p><strong>Next deployment:</strong> ${dates[0] ? dates[0].toLocaleString() : 'No upcoming deployments'}</p>
            <p><strong>Tournaments to create:</strong> ${enabledVariants.length}</p>
            <div style="margin-top: 1rem;">
                ${enabledVariants.map(v => `
                    <div style="margin-bottom: 0.5rem;">
                        ✅ ${v.name} - ${v.entryFee} SOL - Max ${v.maxParticipants} players
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Validate configuration
function validateConfiguration() {
    const container = document.getElementById('testResults');
    if (!container) return;
    
    const issues = [];
    
    // Check deployment days
    const selectedDays = [];
    if (document.getElementById('deployMonday').checked) selectedDays.push('Monday');
    if (document.getElementById('deployTuesday').checked) selectedDays.push('Tuesday');
    if (document.getElementById('deployWednesday').checked) selectedDays.push('Wednesday');
    if (document.getElementById('deployThursday').checked) selectedDays.push('Thursday');
    if (document.getElementById('deployFriday').checked) selectedDays.push('Friday');
    
    if (selectedDays.length === 0) {
        issues.push('❌ No deployment days selected');
    }
    
    // Check enabled variants
    const enabledVariants = currentConfig.tournamentVariants ? 
        currentConfig.tournamentVariants.filter(v => v.enabled !== false) : [];
    if (enabledVariants.length === 0) {
        issues.push('❌ No tournament variants enabled');
    }
    
    // Check platform fee
    const platformFee = parseInt(document.getElementById('platformFee').value);
    if (platformFee < 0 || platformFee > 100) {
        issues.push('❌ Platform fee must be between 0-100%');
    }
    
    container.innerHTML = `
        <div class="preview-section">
            <h3 class="preview-title">Configuration Validation</h3>
            ${issues.length === 0 ? 
                '<div class="alert alert-success">✅ Configuration is valid!</div>' :
                `<div class="alert alert-warning">
                    <strong>Issues found:</strong><br>
                    ${issues.join('<br>')}
                </div>`
            }
        </div>
    `;
}

// Export configuration
function exportConfiguration() {
    const config = {
        ...currentConfig,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `walletwars-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showAlert('Configuration exported!', 'success');
}

// Import configuration
function importConfiguration() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const config = JSON.parse(text);
            
            if (confirm('Import this configuration? This will overwrite current settings.')) {
                currentConfig = config;
                window.TOURNAMENT_CONFIG = config;
                loadCurrentConfig();
                loadVariants();
                updateUIFromConfig();
                showAlert('Configuration imported successfully!', 'success');
            }
        } catch (error) {
            showAlert('Failed to import configuration: ' + error.message, 'error');
        }
    };
    input.click();
}

// Load monitoring data with enhanced participant details
async function loadMonitoringData() {
    if (!window.walletWarsAPI) return;
    
    try {
        // Get tournaments
        const result = await window.walletWarsAPI.getUpcomingTournaments(50);
        if (result.success) {
            const tournaments = result.tournaments;
            
            // Count by status
            const active = tournaments.filter(t => t.status === 'active').length;
            const upcoming = tournaments.filter(t => t.status === 'upcoming' || t.status === 'registering').length;
            
            document.getElementById('totalTournaments').textContent = tournaments.length;
            document.getElementById('activeTournaments').textContent = active;
            document.getElementById('upcomingTournaments').textContent = upcoming;
            
            // Get total players across all tournaments
            let totalPlayers = 0;
            
            // Tournament details with participants
            const detailsContainer = document.getElementById('tournamentDetails');
            
            if (detailsContainer) {
                detailsContainer.innerHTML = '<div class="loading-spinner"></div> Loading tournament details...';
                
                // Get detailed info for each tournament
                const detailedTournaments = [];
                
                for (const tournament of tournaments.slice(0, 10)) { // Show top 10
                    try {
                        // Get entries for this tournament
                        const { data: entries, error } = await window.walletWarsAPI.supabase
                            .from('tournament_entries')
                            .select('*')
                            .eq('tournament_instance_id', tournament.id);
                            
                        if (!error && entries) {
                            totalPlayers += entries.length;
                            detailedTournaments.push({
                                ...tournament,
                                entries: entries
                            });
                        }
                    } catch (err) {
                        console.error('Failed to load entries for tournament:', err);
                    }
                }
                
                // Update total players
                document.getElementById('totalPlayers').textContent = totalPlayers;
                
                // Render tournament details
                detailsContainer.innerHTML = detailedTournaments.length > 0 ? detailedTournaments.map(t => {
                    const metadata = t.deployment_metadata || {};
                    const isOnChain = metadata.tournamentPDA && metadata.escrowPDA;
                    
                    return `
                        <div class="deployment-item">
                            <div class="deployment-header">
                                <div>
                                    <div class="deployment-date">${t.tournament_name || 'Unnamed Tournament'}</div>
                                    <small>
                                        Status: <span class="deployment-status ${t.status}">${t.status}</span> | 
                                        Entry Fee: ${t.entry_fee} SOL | 
                                        Max: ${t.max_participants}
                                        ${isOnChain ? ' | <span class="onchain-indicator yes">⛓️ On-chain</span>' : ' | <span class="onchain-indicator no">📄 Database Only</span>'}
                                    </small>
                                </div>
                                <div>
                                    <strong>${t.entries ? t.entries.length : 0} / ${t.max_participants}</strong> players
                                </div>
                            </div>
                            ${t.entries && t.entries.length > 0 ? `
                                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(139, 92, 246, 0.1);">
                                    <strong>Participants:</strong>
                                    <div style="margin-top: 0.5rem; display: grid; gap: 0.5rem;">
                                        ${t.entries.slice(0, 5).map(e => `
                                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                                <span class="wallet-address">
                                                    ${e.wallet_address.substring(0, 6)}...${e.wallet_address.substring(e.wallet_address.length - 4)}
                                                </span>
                                                <span style="color: #9ca3af; font-size: 0.875rem;">
                                                    ${new Date(e.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        `).join('')}
                                        ${t.entries.length > 5 ? `
                                            <div style="color: #9ca3af; font-size: 0.875rem;">
                                                ... and ${t.entries.length - 5} more
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            ` : ''}
                            ${isOnChain ? `
                                <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(139, 92, 246, 0.1);">
                                    <small style="color: #9ca3af;">
                                        Tournament PDA: ${metadata.tournamentPDA.substring(0, 10)}...${metadata.tournamentPDA.substring(metadata.tournamentPDA.length - 4)}<br>
                                        Escrow PDA: ${metadata.escrowPDA.substring(0, 10)}...${metadata.escrowPDA.substring(metadata.escrowPDA.length - 4)}
                                    </small>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('') : '<div style="padding: 1rem; color: #9ca3af;">No tournaments found</div>';
            }
        }
    } catch (error) {
        console.error('Failed to load monitoring data:', error);
        showAlert('Failed to load monitoring data', 'error');
    }
}

// Load deployment history
async function loadDeploymentHistory() {
    const container = document.getElementById('deploymentHistory');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"></div> Loading deployment history...';
    
    try {
        // Get deployment logs
        const { data: logs, error } = await window.walletWarsAPI.supabase
            .from('admin_logs')
            .select('*')
            .in('action', ['manual_deployment', 'onchain_deployment'])
            .order('created_at', { ascending: false })
            .limit(20);
            
        if (error) throw error;
        
        if (logs && logs.length > 0) {
            container.innerHTML = logs.map(log => {
                const details = log.details || {};
                const results = details.results || [];
                const successCount = results.filter(r => r.success).length;
                const totalCount = results.length;
                const deploymentType = details.deployment_type || 'database';
                
                return `
                    <div class="deployment-item">
                        <div class="deployment-header">
                            <div>
                                <div class="deployment-date">
                                    ${new Date(log.created_at).toLocaleString()}
                                    ${deploymentType === 'onchain' ? ' <span class="onchain-indicator yes">⛓️ On-chain</span>' : ' <span class="onchain-indicator no">📄 Database</span>'}
                                </div>
                                <small>
                                    Deployed by: ${log.admin_wallet.substring(0, 6)}...${log.admin_wallet.substring(log.admin_wallet.length - 4)}
                                </small>
                            </div>
                            <div>
                                <span class="deployment-status ${successCount === totalCount ? 'success' : successCount > 0 ? 'pending' : 'failed'}">
                                    ${successCount} / ${totalCount} Success
                                </span>
                            </div>
                        </div>
                        ${results.length > 0 ? `
                            <div style="margin-top: 0.5rem;">
                                ${results.map(r => `
                                    <div style="padding: 0.25rem 0; color: ${r.success ? '#10b981' : '#ef4444'};">
                                        ${r.success ? '✅' : '❌'} ${r.variant}
                                        ${r.error ? ` - ${r.error}` : ''}
                                        ${r.onChain && r.tournamentPDA ? ` (PDA: ...${r.tournamentPDA.substring(r.tournamentPDA.length - 6)})` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<div style="padding: 1rem; color: #9ca3af;">No deployment history found</div>';
        }
        
    } catch (error) {
        console.error('Failed to load deployment history:', error);
        container.innerHTML = '<div class="alert alert-error">Failed to load deployment history</div>';
    }
}

// Get upcoming deployment dates
function getUpcomingDeploymentDates() {
    const dates = [];
    const today = new Date();
    const deploymentDays = currentConfig.deploymentDays || ['monday', 'thursday'];
    const advanceDays = currentConfig.timing?.advanceDeploymentDays || 21;
    
    for (let i = 0; i < advanceDays; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        
        const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        if (deploymentDays.includes(dayName)) {
            dates.push(checkDate);
        }
    }
    
    return dates;
}

// Update UI from config
function updateUIFromConfig() {
    // Update all form fields with current config values
    if (currentConfig.escrow) {
        document.getElementById('platformFee').value = currentConfig.escrow.platformFeePercentage;
    }
    
    if (currentConfig.weeklyTiers && currentConfig.weeklyTiers.bronze) {
        document.getElementById('prizePool').value = currentConfig.weeklyTiers.bronze.prizePoolPercentage;
    }
    
    if (currentConfig.timing) {
        document.getElementById('tournamentsPerDay').value = currentConfig.timing.maxTournamentsPerDate || 6;
        document.getElementById('advanceDays').value = currentConfig.timing.advanceDeploymentDays || 21;
    }
    
    if (currentConfig.deploymentTime) {
        document.getElementById('deploymentTime').value = currentConfig.deploymentTime.substring(0, 5);
    }
    
    if (currentConfig.deploymentDays) {
        // Reset all checkboxes first
        ['deployMonday', 'deployTuesday', 'deployWednesday', 'deployThursday', 'deployFriday'].forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) checkbox.checked = false;
        });
        
        // Check the saved days
        currentConfig.deploymentDays.forEach(day => {
            const checkboxId = 'deploy' + day.charAt(0).toUpperCase() + day.slice(1);
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) checkbox.checked = true;
        });
    }
    
    // Update test mode
    const isTestMode = window.tournamentTestMode && window.tournamentTestMode.isEnabled();
    updateTestModeUI(isTestMode);
    
    // Update preview
    updateSchedulePreview();
}

// Update schedule preview
function updateSchedulePreview() {
    const container = document.getElementById('schedulePreview');
    if (!container) return;
    
    const tournamentsPerDay = parseInt(document.getElementById('tournamentsPerDay').value);
    
    // Get selected days
    const selectedDays = [];
    if (document.getElementById('deployMonday').checked) selectedDays.push('Monday');
    if (document.getElementById('deployTuesday').checked) selectedDays.push('Tuesday');
    if (document.getElementById('deployWednesday').checked) selectedDays.push('Wednesday');
    if (document.getElementById('deployThursday').checked) selectedDays.push('Thursday');
    if (document.getElementById('deployFriday').checked) selectedDays.push('Friday');
    
    const totalPerWeek = selectedDays.length * tournamentsPerDay;
    
    container.innerHTML = `
        <div class="stats-grid" style="margin-bottom: 1rem;">
            <div class="detail-item">
                <span class="detail-label">Deployments per week</span>
                <span class="detail-value">${selectedDays.length}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Tournaments per deployment</span>
                <span class="detail-value">${tournamentsPerDay}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Total tournaments per week</span>
                <span class="detail-value">${totalPerWeek}</span>
            </div>
        </div>
        <div>
            <strong>Deployment Days:</strong> ${selectedDays.join(', ') || 'None selected'}
        </div>
    `;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Admin Control Center initializing...');
    
    // Load saved configuration from database FIRST
    const savedConfig = await ConfigPersistence.loadFromDatabase();
    if (savedConfig) {
        // Apply saved config to window.TOURNAMENT_CONFIG
        window.TOURNAMENT_CONFIG = { ...window.TOURNAMENT_CONFIG, ...savedConfig };
        currentConfig = savedConfig;
        console.log('📋 Applied saved configuration from database');
    } else {
        // Load current configuration from window
        loadCurrentConfig();
    }
    
    // Update UI with loaded values
    updateUIFromConfig();
    
    // Check connections
    await checkConnections();
    
    // Set up wallet connection listener
    if (window.phantom?.solana) {
        window.phantom.solana.on('connect', async () => {
            console.log('👛 Wallet connected!');
            await checkConnections();
        });
        
        window.phantom.solana.on('disconnect', () => {
            console.log('👛 Wallet disconnected!');
            adminWallet = null;
            escrowIntegration = null;
            updateStatus('walletStatus', false);
            updateStatus('escrowStatus', false);
            document.getElementById('walletText').textContent = 'Not Connected';
        });
    }
    
    // Also check if wallet is already connected but not picked up
    setTimeout(async () => {
        if (window.phantom?.solana?.isConnected && !adminWallet) {
            console.log('👛 Found connected wallet, re-initializing...');
            await checkConnections();
        }
    }, 1000);
    
    // Load initial data
    loadVariants();
    updateSchedulePreview();
    loadMonitoringData();
    
    // Set up auto-save reminder
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        }
    });

    // Update listeners
    document.getElementById('platformFee').addEventListener('input', (e) => {
        document.getElementById('platformFeePreview').textContent = e.target.value + '%';
        isDirty = true;
    });

    document.getElementById('tournamentsPerDay').addEventListener('change', updateSchedulePreview);
    
    // Deployment day checkboxes
    ['deployMonday', 'deployTuesday', 'deployWednesday', 'deployThursday', 'deployFriday'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                updateSchedulePreview();
                isDirty = true;
            });
        }
    });

    // Toggle for new variant modal
    document.getElementById('newVariantEnabled').addEventListener('click', function() {
        this.classList.toggle('active');
    });

    // Deployment type radio listeners
    document.querySelectorAll('input[name="deploymentType"]').forEach(radio => {
        radio.addEventListener('change', updateDeploymentInfo);
    });

    // Refresh monitoring data periodically
    setInterval(() => {
        if (document.getElementById('monitoring-tab').classList.contains('active')) {
            loadMonitoringData();
        }
    }, 30000); // Every 30 seconds
});

// Export functions to global scope for onclick handlers in HTML
window.toggleMobileMenu = toggleMobileMenu;
window.switchTab = switchTab;
window.toggleTestMode = toggleTestMode;
window.saveGlobalConfig = saveGlobalConfig;
window.resetGlobalConfig = resetGlobalConfig;
window.filterVariants = filterVariants;
window.showAddVariantModal = showAddVariantModal;
window.closeAddVariantModal = closeAddVariantModal;
window.addNewVariant = addNewVariant;
window.toggleVariant = toggleVariant;
window.deleteVariant = deleteVariant;
window.updateVariantCapacity = updateVariantCapacity;
window.saveDeploymentSchedule = saveDeploymentSchedule;
window.showDeploymentOptions = showDeploymentOptions;
window.closeDeploymentOptions = closeDeploymentOptions;
window.deployWithSelectedOption = deployWithSelectedOption;
window.createTestTournament = createTestTournament;
window.previewNextDeployment = previewNextDeployment;
window.validateConfiguration = validateConfiguration;
window.testEscrowConnection = testEscrowConnection;
window.exportConfiguration = exportConfiguration;
window.importConfiguration = importConfiguration;