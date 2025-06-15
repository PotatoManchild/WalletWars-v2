// tournament-deployment-manager-enhanced.js
// PERFECT VERSION - Exactly matches your database schema
// Creates tournaments both on-chain AND in database with correct field names

console.log('📅 Loading Enhanced Tournament Deployment Manager (PERFECT SCHEMA MATCH)...');

class EnhancedTournamentDeploymentManager {
    constructor() {
        this.config = window.TOURNAMENT_CONFIG;
        this.testMode = window.tournamentTestMode;
        this.escrowIntegration = null;
        this.deploymentSchedule = null;
        this.lastDeploymentCheck = null;
        
        // Track deployment statistics
        this.stats = {
            tournamentsCreated: 0,
            mockTournamentsCreated: 0,
            realTournamentsCreated: 0,
            failedAttempts: 0
        };
        
        console.log('✅ Enhanced Tournament Deployment Manager initialized (PERFECT SCHEMA)');
        
        // Check if we're in test mode
        if (this.testMode && this.testMode.isEnabled()) {
            console.log('🧪 Running in TEST MODE - blockchain calls will be simulated');
        } else {
            console.log('🔴 Running in PRODUCTION MODE - real blockchain transactions!');
        }
    }
    
    /**
     * Initialize escrow integration
     */
    async initializeEscrow(wallet) {
        if (!wallet) {
            console.error('❌ No wallet provided for escrow integration');
            return false;
        }
        
        try {
            // Check if escrow integration is available
            if (!window.WalletWarsEscrowIntegration) {
                console.error('❌ Escrow integration not loaded');
                return false;
            }
            
            this.escrowIntegration = new window.WalletWarsEscrowIntegration(wallet);
            
            // Test connection
            const testResult = await this.escrowIntegration.testConnection();
            if (testResult.success) {
                console.log('✅ Escrow integration initialized successfully');
                return true;
            } else {
                console.error('❌ Escrow connection test failed:', testResult.message);
                return false;
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize escrow:', error);
            return false;
        }
    }
    
    /**
     * Create a tournament with both on-chain and database components
     */
    async createTournamentWithEscrow(startDate, variant) {
        console.log(`📋 Creating enhanced tournament: ${variant.name}`);
        
        try {
            // Generate unique tournament ID
            const tournamentId = this.generateTournamentId(startDate, variant);
            
            // Calculate times with safe fallbacks
            const validStartDate = new Date(startDate);
            const registrationOpens = new Date(startDate);
            registrationOpens.setDate(registrationOpens.getDate() - 3);
            
            const registrationCloses = new Date(startDate);
            const closeMinutes = this.config.timing?.registrationCloseBeforeStart || 30;
            registrationCloses.setMinutes(registrationCloses.getMinutes() - closeMinutes);
            
            const endTime = new Date(startDate);
            endTime.setDate(endTime.getDate() + (variant.duration || 7));
            
            // Validate all dates
            if (isNaN(validStartDate.getTime()) || isNaN(endTime.getTime()) || 
                isNaN(registrationOpens.getTime()) || isNaN(registrationCloses.getTime())) {
                throw new Error('Invalid date values calculated');
            }
            
            console.log('📅 Calculated dates:', {
                startDate: validStartDate.toISOString(),
                endTime: endTime.toISOString(),
                regOpens: registrationOpens.toISOString(),
                regCloses: registrationCloses.toISOString()
            });
            
            // Step 1: Create on-chain tournament (or mock if in test mode)
            let escrowResult;
            
            if (this.testMode && this.testMode.isEnabled() && !this.testMode.shouldUseRealBlockchain()) {
                // TEST MODE: Use mock
                console.log('🧪 TEST MODE: Creating mock tournament...');
                escrowResult = await this.testMode.mockInitializeTournament({
                    tournamentId,
                    name: variant.name,
                    entryFee: variant.entryFee,
                    maxPlayers: variant.maxParticipants,
                    platformFeePercentage: 10,
                    startTime: Math.floor(validStartDate.getTime() / 1000),
                    endTime: Math.floor(endTime.getTime() / 1000)
                });
            } else {
                // PRODUCTION MODE or ONE REAL TEST
                if (!this.escrowIntegration) {
                    throw new Error('Escrow integration not initialized');
                }
                
                // Check if tournament already exists on-chain
                const existsOnChain = await this.checkTournamentExistsOnChain(tournamentId);
                if (existsOnChain) {
                    console.log(`🔄 Tournament ${tournamentId} already exists on-chain, generating new ID...`);
                    // Generate a new tournament ID and try again
                    return this.createTournamentWithEscrow(startDate, variant);
                }
                
                console.log('🔴 Creating REAL on-chain tournament...');
                escrowResult = await this.escrowIntegration.initializeTournament({
                    tournamentId,
                    name: variant.name,
                    entryFee: variant.entryFee,
                    maxPlayers: variant.maxParticipants,
                    platformFeePercentage: 10,
                    startTime: Math.floor(validStartDate.getTime() / 1000),
                    endTime: Math.floor(endTime.getTime() / 1000)
                });
                
                // If this was the one real test, mark it as used
                if (this.testMode && this.testMode.config.allowOneRealTest) {
                    this.testMode.markRealTestUsed(tournamentId);
                }
            }
            
            if (!escrowResult.success) {
                throw new Error(escrowResult.error || 'Failed to create on-chain tournament');
            }
            
            console.log('✅ On-chain tournament created:', {
                tournamentId,
                tournamentPDA: escrowResult.tournamentPDA,
                escrowPDA: escrowResult.escrowPDA,
                signature: escrowResult.signature,
                mock: escrowResult.mock || false
            });
            
            // Step 2: Get or create template in database
            const template = await this.getOrCreateTemplate(variant);
            
            // Step 3: Create tournament instance with PERFECT schema match
            const dbTournament = {
                // Required fields
                tournament_name: `${variant.name} - ${validStartDate.toLocaleDateString()}`,
                start_time: validStartDate.toISOString(),
                end_time: endTime.toISOString(),
                registration_opens: registrationOpens.toISOString(),
                registration_closes: registrationCloses.toISOString(),
                
                // Optional fields that exist in schema
                template_id: template?.id || null,
                status: 'upcoming',
                min_participants: variant.minParticipants || 10,
                participant_count: 0,
                total_prize_pool: 0,
                
                // On-chain data
                tournament_pda: escrowResult.tournamentPDA || null,
                escrow_pda: escrowResult.escrowPDA || null,
                init_tx_signature: escrowResult.signature || null,
                on_chain_status: escrowResult.mock ? 'mock_initialized' : 'initialized',
                escrow_balance: 0,
                platform_fees_collected: 0,
                
                // Metadata as JSON
                deployment_metadata: {
                    deployedAt: new Date().toISOString(),
                    variant: variant.name,
                    tournamentId: tournamentId,
                    isTestMode: escrowResult.mock || false,
                    entryFee: variant.entryFee,
                    maxParticipants: variant.maxParticipants,
                    prizePoolPercentage: variant.prizePoolPercentage || 85,
                    tradingStyle: variant.tradingStyle || 'pure_wallet'
                }
            };
            
            console.log('📝 Perfect schema tournament insert:', dbTournament);
            
            const { data: dbInstance, error: dbError } = await window.walletWarsAPI.supabase
                .from('tournament_instances')
                .insert(dbTournament)
                .select()
                .single();
            
            if (dbError) {
                console.error('❌ Tournament insert failed:', dbError);
                console.error('Tournament data:', dbTournament);
                throw new Error(`Database insert failed: ${dbError.message}`);
            }
            
            console.log('✅ Tournament created in database:', dbInstance.id);
            
            // Update statistics
            this.stats.tournamentsCreated++;
            if (escrowResult.mock) {
                this.stats.mockTournamentsCreated++;
            } else {
                this.stats.realTournamentsCreated++;
            }
            
            return dbInstance;
            
        } catch (error) {
            console.error(`❌ Failed to create tournament:`, error);
            this.stats.failedAttempts++;
            return null;
        }
    }
    
    /**
     * Generate unique tournament ID with timestamp to ensure uniqueness
     */
    generateTournamentId(startDate, variant) {
        const dateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
        const variantStr = variant.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 10);
        
        // Use timestamp for true uniqueness instead of just random
        const timestamp = Date.now();
        const timestampStr = timestamp.toString().slice(-6); // Last 6 digits of timestamp
        
        return `${variantStr}_${dateStr.substring(2)}_${timestampStr}`;
    }
    
    /**
     * Check if tournament exists on-chain before creating
     */
    async checkTournamentExistsOnChain(tournamentId) {
        if (!this.escrowIntegration) {
            return false;
        }
        
        try {
            const [tournamentPDA] = await this.escrowIntegration.PublicKey.findProgramAddress(
                [this.escrowIntegration.Buffer.from('tournament'), this.escrowIntegration.Buffer.from(tournamentId)],
                this.escrowIntegration.PROGRAM_ID
            );
            
            const accountInfo = await this.escrowIntegration.connection.getAccountInfo(tournamentPDA);
            
            if (accountInfo) {
                console.log(`⚠️ Tournament already exists on-chain: ${tournamentId}`);
                console.log(`   PDA: ${tournamentPDA.toString()}`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking on-chain tournament:', error);
            return false;
        }
    }
    
    /**
     * Get or create tournament template - PERFECT schema match
     */
    async getOrCreateTemplate(variant) {
        try {
            // First, try to find existing template by name
            const { data: existing, error: fetchError } = await window.walletWarsAPI.supabase
                .from('tournament_templates')
                .select('*')
                .eq('name', variant.name)
                .maybeSingle();
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('❌ Error fetching template:', fetchError);
                return null;
            }
            
            if (existing) {
                console.log(`✅ Found existing template: ${variant.name}`);
                return existing;
            }
            
            // Create new template with PERFECT schema match
            console.log(`📝 Creating new template: ${variant.name}`);
            
            const templateData = {
                name: variant.name.substring(0, 100), // Ensure it fits
                tournament_type: 'weekly',
                trading_style: variant.tradingStyle || 'pure_wallet',
                start_day: 'variable',
                entry_fee: parseFloat(variant.entryFee || 0.01),
                max_participants: parseInt(variant.maxParticipants || 100),
                prize_pool_percentage: parseFloat(variant.prizePoolPercentage || 85),
                is_active: true
                // created_at is auto-generated
            };
            
            console.log('📋 Template data (perfect schema):', templateData);
            
            const { data, error } = await window.walletWarsAPI.supabase
                .from('tournament_templates')
                .insert(templateData)
                .select('*')
                .single();
            
            if (error) {
                console.error('❌ Failed to create template:', error);
                // Return null - we can continue without template
                return null;
            }
            
            console.log(`✅ Created new template: ${variant.name}`, data);
            return data;
            
        } catch (error) {
            console.error('❌ Error in getOrCreateTemplate:', error);
            return null;
        }
    }
    
    /**
     * Test mode specific: Create a single test tournament
     */
    async createTestTournament() {
        if (!this.testMode || !this.testMode.isEnabled()) {
            console.error('❌ Test tournaments can only be created in test mode');
            return null;
        }
        
        console.log('🧪 Creating test tournament...');
        
        const testVariant = {
            name: 'Test Tournament ' + Date.now(),
            tradingStyle: 'pure_wallet',
            maxParticipants: 20,
            minParticipants: 2,
            entryFee: 0.001,
            duration: 1,
            prizePoolPercentage: 85
        };
        
        const startDate = new Date(Date.now() + 60 * 60 * 1000); // Start in 1 hour
        
        return await this.createTournamentWithEscrow(startDate, testVariant);
    }
    
    /**
     * Manual tournament creation
     */
    async createManualTournament(params) {
        console.log('🎮 Creating manual tournament...');
        
        const {
            name,
            entryFee,
            maxParticipants,
            startDate,
            duration = 7,
            tradingStyle = 'pure_wallet',
            tier = null
        } = params;
        
        const variant = {
            name,
            tradingStyle,
            maxParticipants,
            minParticipants: 10,
            entryFee,
            duration,
            prizePoolPercentage: 85
        };
        
        const start = startDate ? new Date(startDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        if (isNaN(start.getTime())) {
            throw new Error('Invalid start date provided');
        }
        
        return await this.createTournamentWithEscrow(start, variant);
    }
    
    /**
     * Check if a tournament already exists
     */
    async tournamentExistsExact(startDate, variant) {
        try {
            const startWindow = new Date(startDate.getTime() - 60 * 60 * 1000);
            const endWindow = new Date(startDate.getTime() + 60 * 60 * 1000);
            
            const { data, error } = await window.walletWarsAPI.supabase
                .from('tournament_instances')
                .select('id, tournament_name, start_time, deployment_metadata')
                .ilike('tournament_name', `${variant.name}%`)
                .gte('start_time', startWindow.toISOString())
                .lte('start_time', endWindow.toISOString())
                .neq('status', 'cancelled')
                .limit(1);
            
            if (error) {
                console.error('❌ Error checking tournament existence:', error);
                return false;
            }
            
            return data && data.length > 0;
        } catch (error) {
            console.error('❌ Error in tournamentExistsExact:', error);
            return false;
        }
    }
    
    /**
     * Deploy tournaments for a specific date
     */
    async deployTournamentsForDate(targetDate) {
        let createdCount = 0;
        
        console.log(`📅 Deploying tournaments for ${targetDate.toLocaleDateString()}...`);
        
        if (this.testMode && this.testMode.isEnabled()) {
            console.log('🧪 TEST MODE: Tournaments will be created as mocks');
        }
        
        for (const variant of this.config.tournamentVariants) {
            if (variant.enabled === false) continue;
            
            const exists = await this.tournamentExistsExact(targetDate, variant);
            
            if (!exists) {
                const created = await this.createTournamentWithEscrow(targetDate, variant);
                if (created) {
                    createdCount++;
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } else {
                console.log(`✅ Tournament already exists: ${variant.name} for ${targetDate.toLocaleDateString()}`);
            }
        }
        
        return createdCount;
    }
    
    /**
     * Get deployment statistics
     */
    getStats() {
        return {
            ...this.stats,
            testModeActive: this.testMode && this.testMode.isEnabled(),
            escrowInitialized: !!this.escrowIntegration
        };
    }
}

// Make it available globally
window.EnhancedTournamentDeploymentManager = EnhancedTournamentDeploymentManager;

console.log('✅ Enhanced Tournament Deployment Manager (PERFECT SCHEMA) loaded!');