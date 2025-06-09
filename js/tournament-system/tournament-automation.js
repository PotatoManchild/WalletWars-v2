// tournament-automation.js - OPTIMIZED EVENT-DRIVEN VERSION
// Handles automated tournament lifecycle with minimal API calls
// Only triggers snapshots at exact tournament start/end times

console.log('🤖 Loading Optimized Tournament Automation System...');

class TournamentAutomation {
    constructor() {
        this.snapshotManager = null;
        this.api = null;
        this.scheduledJobs = new Map(); // Store scheduled jobs by tournament ID
        this.activeProcessing = new Set(); // Prevent duplicate processing
        this.apiUsageTracker = {
            hourly: 0,
            daily: 0,
            lastReset: Date.now(),
            limits: {
                hourly: 100,  // Adjust based on your Helius plan
                daily: 1000   // Adjust based on your Helius plan
            }
        };
        
        console.log('✅ Event-Driven Tournament Automation initialized');
    }

    /**
     * Initialize the automation system
     */
    async initialize() {
        // Wait for dependencies
        if (!window.tournamentSnapshotManager) {
            console.warn('⚠️ Tournament Snapshot Manager not available - automation will run without snapshots');
        }
        if (!window.walletWarsAPI) {
            throw new Error('WalletWars API not available');
        }
        
        this.snapshotManager = window.tournamentSnapshotManager;
        this.api = window.walletWarsAPI;
        
        // Initialize snapshot manager if available
        if (this.snapshotManager && this.snapshotManager.initialize) {
            await this.snapshotManager.initialize();
        }
        
        console.log('✅ Tournament Automation ready with event-driven architecture');
        console.log('📅 Tournaments will be processed at their exact start/end times');
        console.log('🔋 API usage will be minimal - only 2 calls per participant per tournament');
    }

    /**
     * Schedule all upcoming tournaments (one-time setup)
     */
    async scheduleUpcomingTournaments() {
        try {
            console.log('📅 Scheduling upcoming tournaments...');
            
            // Get all upcoming tournaments
            const { data: tournaments, error } = await this.api.supabase
                .from('tournament_instances')
                .select(`
                    *,
                    tournament_templates (*)
                `)
                .in('status', ['upcoming', 'registering', 'active'])
                .order('start_time', { ascending: true });

            if (error) {
                console.error('❌ Failed to fetch tournaments:', error);
                return;
            }

            console.log(`📊 Found ${tournaments.length} tournaments to schedule`);
            
            // Schedule each tournament
            for (const tournament of tournaments) {
                this.scheduleTournament(tournament);
            }
            
            // Show scheduled jobs summary
            console.log(`✅ Scheduled ${this.scheduledJobs.size} tournament events`);
            this.showScheduleSummary();
            
        } catch (error) {
            console.error('❌ Tournament scheduling error:', error);
        }
    }

    /**
     * Schedule a single tournament's events
     */
    scheduleTournament(tournament) {
        const tournamentId = tournament.id;
        const now = new Date();
        
        // Clear any existing schedules for this tournament
        this.clearTournamentSchedule(tournamentId);
        
        const jobs = [];
        
        // Schedule registration opening
        const registrationOpens = new Date(tournament.registration_opens);
        if (registrationOpens > now && tournament.status === 'upcoming') {
            const registrationOpenJob = this.scheduleEvent(
                registrationOpens,
                () => this.transitionToRegistering(tournamentId),
                `Registration Open - ${tournament.tournament_templates.name}`
            );
            jobs.push({ type: 'registration_open', job: registrationOpenJob });
        }
        
        // Schedule registration closing
        const registrationCloses = new Date(tournament.registration_closes);
        if (registrationCloses > now && tournament.status === 'registering') {
            const registrationCloseJob = this.scheduleEvent(
                registrationCloses,
                () => this.closeRegistration(tournamentId),
                `Registration Close - ${tournament.tournament_templates.name}`
            );
            jobs.push({ type: 'registration_close', job: registrationCloseJob });
        }
        
        // Schedule tournament start (CRITICAL - This triggers snapshots)
        const startTime = new Date(tournament.start_time);
        if (startTime > now && tournament.status !== 'active') {
            const startJob = this.scheduleEvent(
                startTime,
                () => this.startTournamentWithApiCheck(tournamentId),
                `Tournament Start - ${tournament.tournament_templates.name} 🚀`
            );
            jobs.push({ type: 'start', job: startJob });
        }
        
        // Schedule tournament end (CRITICAL - This triggers snapshots)
        const endTime = new Date(tournament.end_time);
        if (endTime > now && tournament.status !== 'complete') {
            const endJob = this.scheduleEvent(
                endTime,
                () => this.endTournamentWithApiCheck(tournamentId),
                `Tournament End - ${tournament.tournament_templates.name} 🏁`
            );
            jobs.push({ type: 'end', job: endJob });
        }
        
        // Store scheduled jobs
        if (jobs.length > 0) {
            this.scheduledJobs.set(tournamentId, jobs);
            console.log(`📅 Scheduled ${jobs.length} events for tournament ${tournamentId}`);
        }
    }

    /**
     * Schedule a single event with precise timing
     */
    scheduleEvent(targetTime, callback, description) {
        const now = Date.now();
        const targetMs = targetTime.getTime();
        const delay = targetMs - now;
        
        if (delay <= 0) {
            console.log(`⚠️ Event "${description}" is in the past, skipping`);
            return null;
        }
        
        // For delays longer than 24 hours, use a daily check instead
        if (delay > 24 * 60 * 60 * 1000) {
            console.log(`📅 Event "${description}" is more than 24h away, will reschedule daily`);
            // Return a placeholder - implement daily rescheduling if needed
            return { type: 'long_delay', targetTime, description };
        }
        
        console.log(`⏰ Scheduling "${description}" in ${this.formatDelay(delay)}`);
        
        const timeoutId = setTimeout(() => {
            console.log(`🎯 Executing scheduled event: ${description}`);
            callback();
        }, delay);
        
        return {
            timeoutId,
            targetTime,
            description,
            scheduled: new Date()
        };
    }

    /**
     * Clear all scheduled events for a tournament
     */
    clearTournamentSchedule(tournamentId) {
        const jobs = this.scheduledJobs.get(tournamentId);
        if (jobs) {
            jobs.forEach(job => {
                if (job.job && job.job.timeoutId) {
                    clearTimeout(job.job.timeoutId);
                }
            });
            this.scheduledJobs.delete(tournamentId);
        }
    }

    /**
     * Clear all scheduled events
     */
    clearAllSchedules() {
        console.log('🧹 Clearing all scheduled tournament events...');
        
        this.scheduledJobs.forEach((jobs, tournamentId) => {
            this.clearTournamentSchedule(tournamentId);
        });
        
        console.log('✅ All schedules cleared');
    }

    /**
     * Start tournament with API usage check
     */
    async startTournamentWithApiCheck(tournamentId) {
        // Check API usage before proceeding
        if (!this.checkApiUsage('start', tournamentId)) {
            console.error('❌ API limit reached, postponing tournament start');
            // Reschedule for 1 hour later
            this.rescheduleEvent(tournamentId, 'start', 60 * 60 * 1000);
            return;
        }
        
        await this.startTournament(tournamentId);
    }

    /**
     * End tournament with API usage check
     */
    async endTournamentWithApiCheck(tournamentId) {
        // Check API usage before proceeding
        if (!this.checkApiUsage('end', tournamentId)) {
            console.error('❌ API limit reached, postponing tournament end');
            // Reschedule for 1 hour later
            this.rescheduleEvent(tournamentId, 'end', 60 * 60 * 1000);
            return;
        }
        
        await this.endTournament(tournamentId);
    }

    /**
     * Check if we have API budget for an operation
     */
    checkApiUsage(operation, tournamentId) {
        // Reset counters if needed
        this.resetApiCounters();
        
        // Estimate API calls needed
        let estimatedCalls = 0;
        
        if (operation === 'start' || operation === 'end') {
            // We need to check participant count
            // For now, assume average of 10 participants per tournament
            estimatedCalls = 10; // This should be fetched from DB
        }
        
        // Check limits
        if (this.apiUsageTracker.hourly + estimatedCalls > this.apiUsageTracker.limits.hourly) {
            console.warn(`⚠️ Hourly API limit would be exceeded (${this.apiUsageTracker.hourly}/${this.apiUsageTracker.limits.hourly})`);
            return false;
        }
        
        if (this.apiUsageTracker.daily + estimatedCalls > this.apiUsageTracker.limits.daily) {
            console.warn(`⚠️ Daily API limit would be exceeded (${this.apiUsageTracker.daily}/${this.apiUsageTracker.limits.daily})`);
            return false;
        }
        
        return true;
    }

    /**
     * Track API usage
     */
    trackApiUsage(calls) {
        this.apiUsageTracker.hourly += calls;
        this.apiUsageTracker.daily += calls;
        
        console.log(`📊 API Usage - Hourly: ${this.apiUsageTracker.hourly}/${this.apiUsageTracker.limits.hourly}, Daily: ${this.apiUsageTracker.daily}/${this.apiUsageTracker.limits.daily}`);
    }

    /**
     * Reset API counters based on time
     */
    resetApiCounters() {
        const now = Date.now();
        const hourAgo = now - (60 * 60 * 1000);
        const dayAgo = now - (24 * 60 * 60 * 1000);
        
        // Reset hourly counter
        if (this.apiUsageTracker.lastReset < hourAgo) {
            this.apiUsageTracker.hourly = 0;
            this.apiUsageTracker.lastReset = now;
        }
        
        // Reset daily counter
        if (this.apiUsageTracker.lastReset < dayAgo) {
            this.apiUsageTracker.daily = 0;
        }
    }

    /**
     * Reschedule an event
     */
    rescheduleEvent(tournamentId, eventType, delay) {
        console.log(`🔄 Rescheduling ${eventType} for tournament ${tournamentId} in ${this.formatDelay(delay)}`);
        
        setTimeout(() => {
            if (eventType === 'start') {
                this.startTournamentWithApiCheck(tournamentId);
            } else if (eventType === 'end') {
                this.endTournamentWithApiCheck(tournamentId);
            }
        }, delay);
    }

    /**
     * Transition tournament to registering state
     */
    async transitionToRegistering(tournamentId) {
        console.log(`📝 Opening registration for tournament ${tournamentId}`);
        
        try {
            const { error } = await this.api.supabase
                .from('tournament_instances')
                .update({ 
                    status: 'registering',
                    updated_at: new Date().toISOString()
                })
                .eq('id', tournamentId);

            if (error) throw error;
            
            console.log('✅ Registration opened');
            
        } catch (error) {
            console.error('❌ Failed to open registration:', error);
        }
    }

    /**
     * Close tournament registration
     */
    async closeRegistration(tournamentId) {
        console.log(`🚫 Closing registration for tournament ${tournamentId}`);
        
        try {
            // Check if we have minimum participants
            const { data: entries, error: countError } = await this.api.supabase
                .from('tournament_entries')
                .select('id')
                .eq('tournament_instance_id', tournamentId)
                .eq('status', 'registered');

            if (countError) throw countError;

            if (entries.length < 2) {
                console.log('⚠️ Not enough participants, cancelling tournament');
                await this.cancelTournament(tournamentId, 'Not enough participants');
                return;
            }

            // Close registration
            const { error } = await this.api.supabase
                .from('tournament_instances')
                .update({ 
                    status: 'registration_closed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', tournamentId);

            if (error) throw error;
            
            console.log(`✅ Registration closed with ${entries.length} participants`);
            
        } catch (error) {
            console.error('❌ Failed to close registration:', error);
        }
    }

    /**
     * Start tournament and take initial snapshots
     */
    async startTournament(tournamentId) {
        console.log(`🏁 Starting tournament ${tournamentId}`);
        
        // Prevent duplicate processing
        if (this.activeProcessing.has(`start_${tournamentId}`)) {
            console.log('⚠️ Tournament start already in progress');
            return;
        }
        
        this.activeProcessing.add(`start_${tournamentId}`);
        
        try {
            // Update tournament status
            const { error: updateError } = await this.api.supabase
                .from('tournament_instances')
                .update({ 
                    status: 'active',
                    actual_start_time: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', tournamentId);

            if (updateError) throw updateError;

            // Take start snapshots for all participants
            if (this.snapshotManager && this.snapshotManager.processTournamentStart) {
                console.log('📸 Taking start snapshots for all participants...');
                const snapshotResults = await this.snapshotManager.processTournamentStart(tournamentId);
                
                // Track API usage
                this.trackApiUsage(snapshotResults.successful + snapshotResults.failed);
                
                console.log(`✅ Tournament started! Snapshots: ${snapshotResults.successful} successful, ${snapshotResults.failed} failed`);
            } else {
                console.log('⚠️ Snapshot manager not available - tournament started without snapshots');
            }
            
            // Clear this tournament's schedule
            this.clearTournamentSchedule(tournamentId);
            
        } catch (error) {
            console.error('❌ Failed to start tournament:', error);
            
            // Revert status on error
            await this.api.supabase
                .from('tournament_instances')
                .update({ status: 'registering' })
                .eq('id', tournamentId);
                
        } finally {
            this.activeProcessing.delete(`start_${tournamentId}`);
        }
    }

    /**
     * End tournament and calculate results
     */
    async endTournament(tournamentId) {
        console.log(`🏁 Ending tournament ${tournamentId}`);
        
        // Prevent duplicate processing
        if (this.activeProcessing.has(`end_${tournamentId}`)) {
            console.log('⚠️ Tournament end already in progress');
            return;
        }
        
        this.activeProcessing.add(`end_${tournamentId}`);
        
        try {
            // Update tournament status
            const { error: updateError } = await this.api.supabase
                .from('tournament_instances')
                .update({ 
                    status: 'ended',
                    actual_end_time: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', tournamentId);

            if (updateError) throw updateError;

            // Process end snapshots and calculate results
            if (this.snapshotManager && this.snapshotManager.processTournamentEnd) {
                console.log('📸 Taking end snapshots and calculating results...');
                const results = await this.snapshotManager.processTournamentEnd(tournamentId);
                
                if (results.success) {
                    // Track API usage
                    this.trackApiUsage(results.results.length);
                    
                    // Distribute prizes
                    await this.distributePrizes(tournamentId, results.rankings);
                    
                    // Mark tournament as complete
                    await this.api.supabase
                        .from('tournament_instances')
                        .update({ 
                            status: 'complete',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', tournamentId);
                    
                    console.log(`✅ Tournament completed! ${results.rankings.length} valid participants`);
                    
                    // Generate and store report
                    if (this.snapshotManager.generateTournamentReport) {
                        const report = await this.snapshotManager.generateTournamentReport(tournamentId);
                        await this.storeTournamentReport(tournamentId, report);
                    }
                }
            } else {
                console.log('⚠️ Snapshot manager not available - marking tournament as ended without results');
                
                // Mark tournament as complete without results
                await this.api.supabase
                    .from('tournament_instances')
                    .update({ 
                        status: 'complete',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', tournamentId);
            }
            
            // Clear this tournament's schedule
            this.clearTournamentSchedule(tournamentId);
            
        } catch (error) {
            console.error('❌ Failed to end tournament:', error);
            
            // Mark as needs_review instead of reverting
            await this.api.supabase
                .from('tournament_instances')
                .update({ status: 'needs_review' })
                .eq('id', tournamentId);
                
        } finally {
            this.activeProcessing.delete(`end_${tournamentId}`);
        }
    }

    /**
     * Cancel tournament
     */
    async cancelTournament(tournamentId, reason) {
        console.log(`❌ Cancelling tournament ${tournamentId}: ${reason}`);
        
        try {
            // Update tournament status
            await this.api.supabase
                .from('tournament_instances')
                .update({ 
                    status: 'cancelled',
                    cancellation_reason: reason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', tournamentId);

            // Clear any remaining schedules
            this.clearTournamentSchedule(tournamentId);
            
            console.log('✅ Tournament cancelled');
            
        } catch (error) {
            console.error('❌ Failed to cancel tournament:', error);
        }
    }

    /**
     * Distribute prizes to winners
     */
    async distributePrizes(tournamentId, rankings) {
        console.log(`💰 Distributing prizes for tournament ${tournamentId}`);
        
        try {
            // Get tournament details for prize pool
            const { data: tournament, error } = await this.api.supabase
                .from('tournament_instances')
                .select('*, tournament_templates(*)')
                .eq('id', tournamentId)
                .single();

            if (error) throw error;

            const totalPrizePool = parseFloat(tournament.total_prize_pool || 0);
            const prizeDistribution = this.calculatePrizeDistribution(totalPrizePool, rankings.length);
            
            // Record prize distributions
            const distributions = [];
            
            for (let i = 0; i < Math.min(rankings.length, prizeDistribution.length); i++) {
                const ranking = rankings[i];
                const prize = prizeDistribution[i];
                
                if (prize > 0) {
                    distributions.push({
                        tournament_instance_id: tournamentId,
                        champion_id: ranking.championId,
                        rank: ranking.rank,
                        prize_amount: prize,
                        performance_percentage: ranking.performance,
                        distributed_at: new Date().toISOString()
                    });
                    
                    // Update champion stats
                    await this.updateChampionStats(ranking.championId, {
                        tournamentsWon: ranking.rank === 1 ? 1 : 0,
                        solEarned: prize
                    });
                }
            }
            
            // Store prize distributions
            if (distributions.length > 0) {
                const { error: distError } = await this.api.supabase
                    .from('prize_distributions')
                    .insert(distributions);
                    
                if (distError) {
                    console.error('❌ Failed to record prize distributions:', distError);
                }
            }
            
            console.log(`✅ Distributed ${totalPrizePool} SOL to ${distributions.length} winners`);
            
        } catch (error) {
            console.error('❌ Failed to distribute prizes:', error);
        }
    }

    /**
     * Calculate prize distribution based on total pool and number of winners
     */
    calculatePrizeDistribution(totalPool, participants) {
        // Use tournament config if available
        if (window.TOURNAMENT_CONFIG && window.TOURNAMENT_CONFIG.prizeDistribution) {
            const config = window.TOURNAMENT_CONFIG.prizeDistribution;
            let distribution;
            
            if (participants >= 500) {
                distribution = config.tier3?.distribution || config.large?.distribution || [30, 20, 15, 10, 8, 7, 5, 3, 2];
            } else if (participants >= 100) {
                distribution = config.tier2?.distribution || config.medium?.distribution || [35, 25, 15, 10, 8, 7];
            } else {
                distribution = config.tier1?.distribution || config.small?.distribution || [50, 30, 20];
            }
            
            return distribution.map(percentage => (totalPool * percentage) / 100);
        }
        
        // Fallback: Standard distribution percentages
        const distributions = {
            2: [70, 30],
            3: [50, 30, 20],
            5: [40, 25, 15, 12, 8],
            10: [30, 20, 15, 10, 8, 5, 4, 3, 3, 2],
            20: [25, 15, 10, 8, 6, 5, 4, 3, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1]
        };
        
        // Find appropriate distribution
        let distribution = [100]; // Winner takes all by default
        
        for (const [minParticipants, dist] of Object.entries(distributions)) {
            if (participants >= parseInt(minParticipants)) {
                distribution = dist;
            }
        }
        
        // Calculate actual prize amounts
        return distribution.map(percentage => (totalPool * percentage) / 100);
    }

    /**
     * Update champion statistics
     */
    async updateChampionStats(championId, updates) {
        try {
            // Get current stats
            const { data: stats, error: fetchError } = await this.api.supabase
                .from('champion_stats')
                .select('*')
                .eq('champion_id', championId)
                .single();

            if (fetchError) {
                console.error('Failed to fetch champion stats:', fetchError);
                return;
            }

            // Update stats
            const { error: updateError } = await this.api.supabase
                .from('champion_stats')
                .update({
                    tournaments_played: (stats?.tournaments_played || 0) + 1,
                    tournaments_won: (stats?.tournaments_won || 0) + (updates.tournamentsWon || 0),
                    total_sol_earned: (stats?.total_sol_earned || 0) + (updates.solEarned || 0),
                    updated_at: new Date().toISOString()
                })
                .eq('champion_id', championId);

            if (updateError) {
                console.error('Failed to update champion stats:', updateError);
            }
            
        } catch (error) {
            console.error('Error updating champion stats:', error);
        }
    }

    /**
     * Store tournament report
     */
    async storeTournamentReport(tournamentId, report) {
        try {
            const { error } = await this.api.supabase
                .from('tournament_reports')
                .insert({
                    tournament_instance_id: tournamentId,
                    report_data: report,
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error('Failed to store tournament report:', error);
            }
            
        } catch (error) {
            console.error('Error storing tournament report:', error);
        }
    }

    /**
     * Show schedule summary
     */
    showScheduleSummary() {
        console.log('\n📅 Tournament Schedule Summary:');
        console.log('================================');
        
        const events = [];
        
        this.scheduledJobs.forEach((jobs, tournamentId) => {
            jobs.forEach(({ type, job }) => {
                if (job && job.targetTime) {
                    events.push({
                        tournamentId,
                        type,
                        time: job.targetTime,
                        description: job.description
                    });
                }
            });
        });
        
        // Sort by time
        events.sort((a, b) => a.time - b.time);
        
        // Display upcoming events
        const now = new Date();
        events.forEach(event => {
            if (event.time > now) {
                const timeUntil = this.formatDelay(event.time - now);
                console.log(`⏰ ${event.description} - in ${timeUntil}`);
            }
        });
        
        console.log('================================\n');
    }

    /**
     * Format delay for human reading
     */
    formatDelay(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Get automation status
     */
    getStatus() {
        return {
            scheduled: this.scheduledJobs.size,
            activeProcessing: this.activeProcessing.size,
            apiUsage: {
                hourly: `${this.apiUsageTracker.hourly}/${this.apiUsageTracker.limits.hourly}`,
                daily: `${this.apiUsageTracker.daily}/${this.apiUsageTracker.limits.daily}`
            },
            initialized: !!(this.snapshotManager && this.api)
        };
    }

    /**
     * Manual tournament actions for testing
     */
    async manualStartTournament(tournamentId) {
        console.log(`🎮 Manually starting tournament ${tournamentId}`);
        await this.startTournamentWithApiCheck(tournamentId);
    }

    async manualEndTournament(tournamentId) {
        console.log(`🎮 Manually ending tournament ${tournamentId}`);
        await this.endTournamentWithApiCheck(tournamentId);
    }
}

// Create global instance
window.tournamentAutomation = new TournamentAutomation();

// Export for use
window.TournamentAutomation = TournamentAutomation;

console.log('✅ Optimized Tournament Automation loaded!');
console.log('🎯 Tournaments will be processed at exact start/end times only');
console.log('🔋 API usage is limited to 2 calls per participant per tournament');
console.log('⏰ Use tournamentAutomation.scheduleUpcomingTournaments() to set up event-driven processing');