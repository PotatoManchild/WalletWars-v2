// tournament-lifecycle-manager.js
// Manages tournament lifecycle states and transitions

console.log('🔄 Loading Tournament Lifecycle Manager...');

class TournamentLifecycleManager {
    constructor() {
        this.snapshotManager = window.tournamentSnapshotManager;
        this.walletWarsAPI = window.walletWarsAPI;
    }
    
    /**
     * Open tournament registration
     */
    async openRegistration(tournamentId) {
        console.log(`📝 Opening registration for tournament ${tournamentId}`);
        
        const { error } = await this.walletWarsAPI.supabase
            .from('tournament_instances')
            .update({
                status: 'registering',
                updated_at: new Date().toISOString()
            })
            .eq('id', tournamentId);
        
        if (!error) {
            console.log('✅ Registration opened');
        } else {
            console.error('❌ Failed to open registration:', error);
        }
    }
    
    /**
     * Close registration and check minimum participants
     */
    async closeRegistrationAndCheck(tournamentId) {
        console.log(`🔒 Closing registration for tournament ${tournamentId}`);
        
        try {
            // Get tournament details with participant count
            const { data: tournament, error } = await this.walletWarsAPI.supabase
                .from('tournament_instances')
                .select('*')
                .eq('id', tournamentId)
                .single();
            
            if (error) {
                console.error('❌ Failed to get tournament details:', error);
                return;
            }
            
            // Get actual participant count
            const { count } = await this.walletWarsAPI.supabase
                .from('tournament_entries')
                .select('id', { count: 'exact', head: true })
                .eq('tournament_instance_id', tournamentId)
                .eq('status', 'registered');
            
            const participantCount = count || 0;
            const minParticipants = tournament.min_participants || 10;
            
            console.log(`📊 Tournament has ${participantCount} participants (minimum: ${minParticipants})`);
            
            if (participantCount < minParticipants) {
                // Cancel tournament
                await this.cancelTournament(tournamentId, 'Insufficient participants');
            } else {
                // Update status to pending start
                await this.walletWarsAPI.supabase
                    .from('tournament_instances')
                    .update({
                        status: 'pending_start',
                        participant_count: participantCount,
                        total_prize_pool: participantCount * tournament.entry_fee * (tournament.prize_pool_percentage / 100),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', tournamentId);
                
                console.log('✅ Tournament will start as scheduled');
            }
        } catch (error) {
            console.error('❌ Error in closeRegistrationAndCheck:', error);
        }
    }
    
    /**
     * Cancel tournament and process refunds
     */
    async cancelTournament(tournamentId, reason) {
        console.log(`❌ Cancelling tournament ${tournamentId}: ${reason}`);
        
        try {
            // Update tournament status
            await this.walletWarsAPI.supabase
                .from('tournament_instances')
                .update({
                    status: 'cancelled',
                    cancellation_reason: reason,
                    cancelled_at: new Date().toISOString()
                })
                .eq('id', tournamentId);
            
            // Get all entries for refunds
            const { data: entries } = await this.walletWarsAPI.supabase
                .from('tournament_entries')
                .select('*')
                .eq('tournament_instance_id', tournamentId)
                .eq('status', 'registered');
            
            // Process refunds
            for (const entry of entries || []) {
                await this.processRefund(entry);
            }
            
            console.log(`✅ Tournament cancelled, ${entries?.length || 0} refunds to process`);
        } catch (error) {
            console.error('❌ Error cancelling tournament:', error);
        }
    }
    
    /**
     * Process refund for a single entry
     */
    async processRefund(entry) {
        try {
            // Create refund record
            await this.walletWarsAPI.supabase
                .from('tournament_refunds')
                .insert({
                    tournament_entry_id: entry.id,
                    tournament_instance_id: entry.tournament_instance_id,
                    wallet_address: entry.wallet_address,
                    amount: entry.entry_fee_paid,
                    status: 'pending'
                });
            
            // Update entry status
            await this.walletWarsAPI.supabase
                .from('tournament_entries')
                .update({
                    status: 'refunded',
                    updated_at: new Date().toISOString()
                })
                .eq('id', entry.id);
            
            console.log(`💰 Refund record created for entry ${entry.id}`);
            
            // TODO: Integrate with escrow service to process actual refund
            // This would require calling the escrow's refundPlayer method
        } catch (error) {
            console.error('❌ Error processing refund:', error);
        }
    }
    
    /**
     * Start tournament
     */
    async startTournament(tournamentId) {
        console.log(`🏁 Starting tournament ${tournamentId}`);
        
        try {
            // Update status
            await this.walletWarsAPI.supabase
                .from('tournament_instances')
                .update({
                    status: 'active',
                    actual_start_time: new Date().toISOString()
                })
                .eq('id', tournamentId);
            
            // Take start snapshots if snapshot manager is available
            if (this.snapshotManager && this.snapshotManager.processTournamentStart) {
                await this.snapshotManager.processTournamentStart(tournamentId);
            } else {
                console.warn('⚠️ Snapshot manager not available');
            }
            
            console.log('✅ Tournament started');
        } catch (error) {
            console.error('❌ Error starting tournament:', error);
        }
    }
    
    /**
     * End tournament
     */
    async endTournament(tournamentId) {
        console.log(`🏁 Ending tournament ${tournamentId}`);
        
        try {
            // Update status
            await this.walletWarsAPI.supabase
                .from('tournament_instances')
                .update({
                    status: 'ended',
                    actual_end_time: new Date().toISOString()
                })
                .eq('id', tournamentId);
            
            // Process end snapshots and calculate results if available
            let results = null;
            if (this.snapshotManager && this.snapshotManager.processTournamentEnd) {
                results = await this.snapshotManager.processTournamentEnd(tournamentId);
            } else {
                console.warn('⚠️ Snapshot manager not available for results calculation');
            }
            
            // Distribute prizes if we have results
            if (results && results.rankings) {
                await this.distributePrizes(tournamentId, results.rankings);
            }
            
            // Mark complete
            await this.walletWarsAPI.supabase
                .from('tournament_instances')
                .update({
                    status: 'complete',
                    completed_at: new Date().toISOString()
                })
                .eq('id', tournamentId);
            
            console.log('✅ Tournament completed');
        } catch (error) {
            console.error('❌ Error ending tournament:', error);
        }
    }
    
    /**
     * Calculate and distribute prizes
     */
    async distributePrizes(tournamentId, rankings) {
        try {
            const { data: tournament } = await this.walletWarsAPI.supabase
                .from('tournament_instances')
                .select('*')
                .eq('id', tournamentId)
                .single();
            
            if (!tournament) {
                console.error('❌ Tournament not found');
                return;
            }
            
            const totalPrize = tournament.total_prize_pool || 0;
            const participantCount = tournament.participant_count || 0;
            
            // Determine distribution tier
            let distribution;
            if (window.TOURNAMENT_CONFIG && window.TOURNAMENT_CONFIG.prizeDistribution) {
                if (participantCount >= 500) {
                    distribution = window.TOURNAMENT_CONFIG.prizeDistribution.tier3?.distribution || 
                                 window.TOURNAMENT_CONFIG.prizeDistribution.large?.distribution;
                } else if (participantCount >= 100) {
                    distribution = window.TOURNAMENT_CONFIG.prizeDistribution.tier2?.distribution || 
                                 window.TOURNAMENT_CONFIG.prizeDistribution.medium?.distribution;
                } else {
                    distribution = window.TOURNAMENT_CONFIG.prizeDistribution.tier1?.distribution || 
                                 window.TOURNAMENT_CONFIG.prizeDistribution.small?.distribution;
                }
            }
            
            // Fallback if no config
            if (!distribution) {
                distribution = participantCount >= 10 ? [50, 30, 20] : [70, 30];
            }
            
            // Calculate individual prizes
            const prizes = distribution.map(percentage => (totalPrize * percentage) / 100);
            
            // Award prizes to top performers
            for (let i = 0; i < Math.min(rankings.length, prizes.length); i++) {
                const winner = rankings[i];
                const prizeAmount = prizes[i];
                
                if (prizeAmount > 0) {
                    await this.awardPrize(tournamentId, winner, prizeAmount, i + 1);
                }
            }
            
            console.log(`💰 Distributed prizes to ${Math.min(rankings.length, prizes.length)} winners`);
        } catch (error) {
            console.error('❌ Error distributing prizes:', error);
        }
    }
    
    /**
     * Award prize to a winner
     */
    async awardPrize(tournamentId, winner, amount, rank) {
        try {
            // Create prize distribution record
            await this.walletWarsAPI.supabase
                .from('prize_distributions')
                .insert({
                    tournament_instance_id: tournamentId,
                    champion_id: winner.championId,
                    rank: rank,
                    prize_amount: amount,
                    status: 'pending'
                });
            
            // Update tournament entry
            await this.walletWarsAPI.supabase
                .from('tournament_entries')
                .update({
                    final_rank: rank,
                    prize_won: amount
                })
                .eq('id', winner.entryId);
            
            console.log(`🏆 Awarded ${amount} SOL to rank ${rank} winner`);
            
            // TODO: Integrate with escrow service to send actual prize
            // This would require calling the escrow's distributePrize method
        } catch (error) {
            console.error('❌ Error awarding prize:', error);
        }
    }
    
    /**
     * Get tournament lifecycle status
     */
    async getTournamentLifecycleStatus(tournamentId) {
        try {
            const { data: tournament } = await this.walletWarsAPI.supabase
                .from('tournament_instances')
                .select('*')
                .eq('id', tournamentId)
                .single();
            
            if (!tournament) {
                return { error: 'Tournament not found' };
            }
            
            const now = new Date();
            const registrationOpens = new Date(tournament.registration_opens);
            const registrationCloses = new Date(tournament.registration_closes);
            const startTime = new Date(tournament.start_time);
            const endTime = new Date(tournament.end_time);
            
            return {
                id: tournament.id,
                status: tournament.status,
                timeline: {
                    registrationOpens: registrationOpens.toISOString(),
                    registrationCloses: registrationCloses.toISOString(),
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString()
                },
                canRegister: tournament.status === 'registering' && now >= registrationOpens && now < registrationCloses,
                participantCount: tournament.participant_count || 0,
                minParticipants: tournament.min_participants || 10,
                prizePool: tournament.total_prize_pool || 0
            };
        } catch (error) {
            console.error('❌ Error getting tournament lifecycle status:', error);
            return { error: error.message };
        }
    }
    
    /**
     * Manually transition tournament to next lifecycle state
     */
    async transitionToNextState(tournamentId) {
        try {
            const { data: tournament } = await this.walletWarsAPI.supabase
                .from('tournament_instances')
                .select('*')
                .eq('id', tournamentId)
                .single();
            
            if (!tournament) {
                throw new Error('Tournament not found');
            }
            
            const currentStatus = tournament.status;
            let nextAction;
            
            switch (currentStatus) {
                case 'scheduled':
                case 'upcoming':
                    nextAction = () => this.openRegistration(tournamentId);
                    break;
                case 'registering':
                    nextAction = () => this.closeRegistrationAndCheck(tournamentId);
                    break;
                case 'pending_start':
                case 'registration_closed':
                    nextAction = () => this.startTournament(tournamentId);
                    break;
                case 'active':
                    nextAction = () => this.endTournament(tournamentId);
                    break;
                default:
                    console.log(`⚠️ Tournament in ${currentStatus} state cannot be transitioned`);
                    return;
            }
            
            console.log(`🔄 Transitioning tournament from ${currentStatus} to next state...`);
            await nextAction();
            
        } catch (error) {
            console.error('❌ Error transitioning tournament:', error);
        }
    }
}

// Make it available globally
window.TournamentLifecycleManager = TournamentLifecycleManager;
window.tournamentLifecycleManager = new TournamentLifecycleManager();

console.log('✅ Tournament Lifecycle Manager loaded!');
console.log('🔄 Available at: window.tournamentLifecycleManager');