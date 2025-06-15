// tournament-deployment-manager-enhanced.js
// FIXED VERSION - Schema-aligned deployment manager
// Creates tournaments both on-chain AND in database with correct field names

console.log('📅 Loading Enhanced Tournament Deployment Manager (FIXED)...');

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
        
        console.log('✅ Enhanced Tournament Deployment Manager initialized (FIXED)');
        
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
            // Generate unique tournament ID - SHORTER VERSION
            const tournamentId = this.generateTournamentId(startDate, variant);
            
            // Calculate times - FIXED
            const registrationOpens = new Date(startDate);
            registrationOpens.setDate(registrationOpens.getDate() - 3);
            
            const registrationCloses = new Date(startDate);
            // Use a safe default if timing config is missing
            const closeMinutes = this.config.timing?.registrationCloseBeforeStart || 30;
            registrationCloses.setMinutes(registrationCloses.getMinutes() - closeMinutes);
            
            const endTime = new Date(startDate);
            endTime.setDate(endTime.getDate() + (variant.duration || 7));
            
            // Determine tier from entry fee
            const tier = this.getTierFromEntryFee(variant.entryFee);
            
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
                    startTime: Math.floor(startDate.getTime() / 1000),
                    endTime: Math.floor(endTime.getTime() / 1000)
                });
            } else {
                // PRODUCTION MODE or ONE REAL TEST
                if (!this.escrowIntegration) {
                    throw new Error('Escrow integration not initialized');
                }
                
                console.log('🔴 Creating REAL on-chain tournament...');
                escrowResult = await this.escrowIntegration.initializeTournament({
                    tournamentId,
                    name: variant.name,
                    entryFee: variant.entryFee,
                    maxPlayers: variant.maxParticipants,
                    platformFeePercentage: 10,
                    startTime: Math.floor(startDate.getTime() / 1000),
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
            
            // Step 2: Get or create template in database (FIXED)
            const template = await this.getOrCreateTemplate(variant);
            if (!template) {
                throw new Error('Failed to get/create template');
            }
            
            // Step 3: Create tournament instance in database (FIXED SCHEMA)
            // Ensure all dates are valid
            const validStartDate = new Date(startDate);
            const validEndTime = new Date(endTime);
            const validRegOpens = new Date(registrationOpens);
            const validRegCloses = new Date(registrationCloses);
            
            // Debug log the dates
            console.log('📅 Date calculations:', {
                startDate: validStartDate.toISOString(),
                endTime: validEndTime.toISOString(),
                regOpens: validRegOpens.toISOString(),
                regCloses: validRegCloses.toISOString()
            });
            
            // Check for invalid dates
            if (isNaN(validStartDate.getTime()) || isNaN(validEndTime.getTime()) || 
                isNaN(validRegOpens.getTime()) || isNaN(validRegCloses.getTime())) {
                throw new Error('Invalid date values calculated');
            }
            
            const dbTournament = {
                tournament_name: `${variant.name} - ${validStartDate.toLocaleDateString()}`,
                entry_fee: parseFloat(variant.entryFee),
                max_participants: parseInt(variant.maxParticipants),
                status: 'upcoming',
                start_time: validStartDate.toISOString(),
                end_time: validEndTime.toISOString(),
                registration_start: validRegOpens.toISOString(),
                registration_end: validRegCloses.toISOString(),
                trading_style: variant.tradingStyle || 'pure_wallet',
                prize_pool_percentage: parseFloat(variant.prizePoolPercentage || 85),
                platform_fee_percentage: parseFloat(this.config.escrow?.platformFeePercentage || 10)
            };
            
            console.log('📝 Attempting tournament insert with fixed schema:', dbTournament);
            
            // Try the most minimal possible insert first
            const ultraMinimal = {
                tournament_name: `Test ${Date.now()}`,
                entry_fee: 0.01,
                max_participants: 100,
                start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                end_time: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'upcoming'
            };
            
            console.log('🧪 Testing ultra-minimal insert first:', ultraMinimal);
            
            const { data: testInsert, error: testError } = await window.walletWarsAPI.supabase
                .from('tournament_instances')
                .insert(ultraMinimal)
                .select()
                .single();
                
            if (testError) {
                console.error('❌ Even ultra-minimal insert failed:', testError);
                throw new Error(`Ultra-minimal insert failed: ${testError.message}`);
            }
            
            console.log('✅ Ultra-minimal insert worked! Trying full insert...');
            
            const { data: dbInstance, error: dbError } = await window.walletWarsAPI.supabase
                .from('tournament_instances')
                .insert(dbTournament)
                .select()
                .single();
            
            if (dbError) {
                console.error('❌ Database insert failed:', dbError);
                console.error('Tournament data:', dbTournament);
                
                // Try a minimal insert with only the most basic fields
                console.log('🔄 Trying minimal insert...');
                const minimalTournament = {
                    tournament_name: `${variant.name} - ${validStartDate.toLocaleDateString()}`,
                    entry_fee: parseFloat(variant.entryFee),
                    max_participants: parseInt(variant.maxParticipants),
                    start_time: validStartDate.toISOString(),
                    end_time: validEndTime.toISOString(),
                    status: 'upcoming'
                };
                
                const { data: minimalData, error: minimalError } = await window.walletWarsAPI.supabase
                    .from('tournament_instances')
                    .insert(minimalTournament)
                    .select()
                    .single();
                    
                if (minimalError) {
                    throw new Error(`Database error (minimal): ${minimalError.message}`);
                }
                
                console.log('✅ Minimal tournament created:', minimalData.id);
                
                // Try to update with additional metadata if possible
                if (minimalData && minimalData.id) {
                    const { error: updateError } = await window.walletWarsAPI.supabase
                        .from('tournament_instances')
                        .update({
                            deployment_metadata: {
                                tournamentId: tournamentId,
                                tournamentPDA: escrowResult.tournamentPDA,
                                escrowPDA: escrowResult.escrowPDA,
                                mock: escrowResult.mock || false,
                                deployedAt: new Date().toISOString()
                            }
                        })
                        .eq('id', minimalData.id);
                        
                    if (updateError) {
                        console.warn('⚠️ Could not update metadata:', updateError);
                    }
                }
                
                return minimalData;
            }
            
            console.log('✅ Tournament created in database:', dbInstance.id);
            
            // Step 3b: Update with additional metadata
            if (dbInstance && dbInstance.id) {
                const updateData = {
                    deployment_metadata: {
                        deployedAt: new Date().toISOString(),
                        variant: variant.name,
                        tier: tier,
                        tournamentId: tournamentId,
                        tournamentPDA: escrowResult.tournamentPDA,
                        escrowPDA: escrowResult.escrowPDA,
                        initTxSignature: escrowResult.signature,
                        onChainStatus: 'initialized',
                        isTestMode: escrowResult.mock || false,
                        entryFee: variant.entryFee,
                        maxParticipants: variant.maxParticipants,
                        prizePoolPercentage: variant.prizePoolPercentage || 85
                    }
                };
                
                const { error: updateError } = await window.walletWarsAPI.supabase
                    .from('tournament_instances')
                    .update(updateData)
                    .eq('id', dbInstance.id);
                    
                if (updateError) {
                    console.warn('⚠️ Could not update metadata:', updateError);
                }
            }
            
            // Step 4: Schedule lifecycle events
            await this.scheduleLifecycleEvents(dbInstance);
            
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
     * Generate unique tournament ID - FIXED to be shorter
     */
    generateTournamentId(startDate, variant) {
        const dateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
        // Make variant string shorter - remove special characters and limit length
        const variantStr = variant.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
            .substring(0, 10); // Limit to 10 chars
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        // Create shorter tournament ID
        return `${variantStr}_${dateStr.substring(2)}_${random}`; // Use only last 6 digits of date
    }
    
    /**
     * Get or create tournament template - FIXED SCHEMA
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
            
            // Create new template with FIXED schema
            console.log(`📝 Creating new template: ${variant.name}`);
            
            // Use only fields that actually exist in the tournament_templates table
            const templateData = {
                name: variant.name.substring(0, 50),
                tournament_type: 'weekly',
                trading_style: variant.tradingStyle || 'pure_wallet',
                start_day: 'variable',
                entry_fee: variant.entryFee || 0.01,
                max_participants: variant.maxParticipants || 100,
                // REMOVED: min_participants - this column doesn't exist
                prize_pool_percentage: variant.prizePoolPercentage || 85,
                is_active: true
                // REMOVED: created_at - auto-generated
            };
            
            console.log('📋 Template data to insert (FIXED):', templateData);
            
            const { data, error } = await window.walletWarsAPI.supabase
                .from('tournament_templates')
                .insert(templateData)
                .select('*')
                .single();
            
            if (error) {
                console.error('❌ Failed to create template:', error);
                console.error('Template data:', templateData);
                
                // Return a fallback template to continue deployment
                console.warn('⚠️ Using fallback template to continue deployment');
                return {
                    id: 'temp_' + Date.now(),
                    name: variant.name,
                    tournament_type: 'weekly',
                    trading_style: variant.tradingStyle || 'pure_wallet',
                    entry_fee: variant.entryFee,
                    max_participants: variant.maxParticipants,
                    prize_pool_percentage: variant.prizePoolPercentage || 85,
                    is_active: true
                };
            }
            
            console.log(`✅ Created new template: ${variant.name}`, data);
            return data;
            
        } catch (error) {
            console.error('❌ Error in getOrCreateTemplate:', error);
            
            // Return a temporary template to allow the process to continue
            console.warn('⚠️ Using fallback template to continue deployment');
            return {
                id: 'temp_' + Date.now(),
                name: variant.name,
                tournament_type: 'weekly',
                trading_style: variant.tradingStyle || 'pure_wallet',
                entry_fee: variant.entryFee,
                max_participants: variant.maxParticipants,
                prize_pool_percentage: variant.prizePoolPercentage || 85,
                is_active: true
            };
        }
    }
    
    /**
     * Manual tournament creation with specific parameters
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
        
        // Create variant object
        const variant = {
            name,
            tradingStyle,
            maxParticipants,
            minParticipants: 10,
            entryFee,
            duration,
            prizePoolPercentage: 85
        };
        
        // Use provided start date or default to tomorrow
        const start = startDate ? new Date(startDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        // Ensure the start date is valid
        if (isNaN(start.getTime())) {
            throw new Error('Invalid start date provided');
        }
        
        return await this.createTournamentWithEscrow(start, variant);
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
            entryFee: 0.001, // Very small for testing
            duration: 1, // 1 day
            prizePoolPercentage: 85
        };
        
        const startDate = new Date(Date.now() + 60 * 60 * 1000); // Start in 1 hour
        
        return await this.createTournamentWithEscrow(startDate, testVariant);
    }
    
    /**
     * Check if a specific tournament variant already exists
     */
    async tournamentExistsExact(startDate, variant) {
        try {
            const startWindow = new Date(startDate.getTime() - 60 * 60 * 1000);
            const endWindow = new Date(startDate.getTime() + 60 * 60 * 1000);
            
            // Look for tournaments with the same name in the time window
            const { data, error } = await window.walletWarsAPI.supabase
                .from('tournament_instances')
                .select('id, tournament_name, start_time, deployment_metadata')
                .ilike('tournament_name', `${variant.name}%`)
                .gte('start_time', startWindow.toISOString())
                .lte('start_time', endWindow.toISOString())
                .not('status', 'eq', 'cancelled')
                .limit(1);
            
            if (error) {
                console.error('❌ Error checking tournament existence:', error);
                return false;
            }
            
            const exists = data && data.length > 0;
            if (exists) {
                console.log(`🔍 Found existing: ${variant.name} at ${data[0].start_time}`);
                
                // Check if it has on-chain data
                const metadata = data[0].deployment_metadata;
                if (metadata && metadata.tournamentPDA) {
                    console.log('✅ Tournament has on-chain data:', metadata.tournamentPDA);
                } else {
                    console.log('⚠️ Tournament exists but lacks on-chain data');
                }
            }
            
            return exists;
        } catch (error) {
            console.error('❌ Error in tournamentExistsExact:', error);
            return false;
        }
    }
    
    /**
     * Schedule automated lifecycle transitions
     */
    async scheduleLifecycleEvents(tournament) {
        const now = new Date();
        
        // Schedule registration open
        if (tournament.registration_start) {
            const registrationOpensAt = new Date(tournament.registration_start);
            if (registrationOpensAt > now) {
                const delay = registrationOpensAt - now;
                setTimeout(async () => {
                    if (window.tournamentLifecycleManager) {
                        await window.tournamentLifecycleManager.openRegistration(tournament.id);
                    }
                }, delay);
                console.log(`⏰ Scheduled registration open in ${Math.round(delay / 1000 / 60)} minutes`);
            }
        }
        
        // Schedule tournament start
        const startTime = new Date(tournament.start_time);
        if (startTime > now) {
            const delay = startTime - now;
            setTimeout(async () => {
                if (window.tournamentLifecycleManager) {
                    await window.tournamentLifecycleManager.startTournament(tournament.id);
                }
            }, delay);
            console.log(`⏰ Scheduled tournament start in ${Math.round(delay / 1000 / 60)} minutes`);
        }
    }
    
    /**
     * Get tier from entry fee
     */
    getTierFromEntryFee(entryFee) {
        if (entryFee <= 0.01) return 'bronze';
        if (entryFee <= 0.05) return 'silver';
        if (entryFee <= 0.1) return 'gold';
        return 'diamond';
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
    
    /**
     * Deploy tournaments for a specific date
     */
    async deployTournamentsForDate(targetDate) {
        let createdCount = 0;
        
        console.log(`📅 Deploying tournaments for ${targetDate.toLocaleDateString()}...`);
        
        // Show test mode warning if active
        if (this.testMode && this.testMode.isEnabled()) {
            console.log('🧪 TEST MODE: Tournaments will be created as mocks');
        }
        
        for (const variant of this.config.tournamentVariants) {
            const exists = await this.tournamentExistsExact(targetDate, variant);
            
            if (!exists) {
                const created = await this.createTournamentWithEscrow(targetDate, variant);
                if (created) {
                    createdCount++;
                    await new Promise(resolve => setTimeout(resolve, 500)); // Delay between creations
                }
            } else {
                console.log(`✅ Tournament already exists: ${variant.name} for ${targetDate.toLocaleDateString()}`);
            }
        }
        
        return createdCount;
    }
    
    /**
     * Get upcoming deployment dates
     */
    getUpcomingDeploymentDates() {
        const dates = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < this.config.timing.advanceDeploymentDays; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + i);
            
            const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'lowercase' });
            
            if (this.config.deploymentDays.includes(dayName)) {
                const [hours, minutes, seconds] = this.config.deploymentTime.split(':');
                checkDate.setUTCHours(parseInt(hours), parseInt(minutes), parseInt(seconds), 0);
                
                if (checkDate > new Date()) {
                    dates.push(checkDate);
                }
            }
        }
        
        return dates;
    }
}

// Make it available globally
window.EnhancedTournamentDeploymentManager = EnhancedTournamentDeploymentManager;

console.log('✅ Enhanced Tournament Deployment Manager (FIXED) loaded!');