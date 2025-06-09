// tournament-snapshot-manager.js
// Manages tournament snapshots at start/end only for efficiency
// Includes anti-cheat detection and performance calculation

console.log('📸 Loading Tournament Snapshot Manager...');

class TournamentSnapshotManager {
    constructor() {
        this.walletService = null;
        this.api = null;
        
        // Anti-cheat thresholds
        this.antiCheatConfig = {
            maxDailyGainPercent: 1000, // 10x in a day is suspicious
            maxWeeklyGainPercent: 5000, // 50x in a week is very suspicious
            minTransactionInterval: 30, // seconds between transactions
            suspiciousPatterns: [
                'large_single_deposit', // Single large deposit during tournament
                'multiple_small_deposits', // Many small deposits to avoid detection
                'wallet_cycling', // Funds moving in circles
                'timing_manipulation' // Deposits right before end
            ]
        };
        
        console.log('✅ Tournament Snapshot Manager initialized');
    }

    /**
     * Initialize dependencies
     */
    async initialize() {
        // Wait for services to be available
        if (!window.enhancedWalletService) {
            throw new Error('Enhanced Wallet Service not available');
        }
        if (!window.walletWarsAPI) {
            throw new Error('WalletWars API not available');
        }
        
        this.walletService = window.enhancedWalletService;
        this.api = window.walletWarsAPI;
        
        console.log('✅ Snapshot Manager dependencies loaded');
    }

    /**
     * Take tournament start snapshot for a participant
     */
    async takeStartSnapshot(tournamentEntryId, walletAddress) {
        try {
            console.log(`📸 Taking START snapshot for tournament entry ${tournamentEntryId}`);
            
            // Get wallet snapshot
            const snapshot = await this.walletService.getFullWalletSnapshot(walletAddress);
            
            // Store in database
            const result = await this.api.takeWalletSnapshot(
                walletAddress,
                tournamentEntryId,
                'start' // snapshot type
            );
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            console.log(`✅ Start snapshot saved: ${snapshot.totalValueSol} SOL total value`);
            
            // Update tournament entry with snapshot reference
            await this.api.updateTournamentEntrySnapshot(
                tournamentEntryId,
                'start',
                result.snapshot.id
            );
            
            return {
                success: true,
                snapshot: result.snapshot,
                totalValue: snapshot.totalValueSol
            };
            
        } catch (error) {
            console.error('❌ Failed to take start snapshot:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Take tournament end snapshot for a participant
     */
    async takeEndSnapshot(tournamentEntryId, walletAddress) {
        try {
            console.log(`📸 Taking END snapshot for tournament entry ${tournamentEntryId}`);
            
            // Get wallet snapshot
            const snapshot = await this.walletService.getFullWalletSnapshot(walletAddress);
            
            // Store in database
            const result = await this.api.takeWalletSnapshot(
                walletAddress,
                tournamentEntryId,
                'end' // snapshot type
            );
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            console.log(`✅ End snapshot saved: ${snapshot.totalValueSol} SOL total value`);
            
            // Update tournament entry with snapshot reference
            await this.api.updateTournamentEntrySnapshot(
                tournamentEntryId,
                'end',
                result.snapshot.id
            );
            
            return {
                success: true,
                snapshot: result.snapshot,
                totalValue: snapshot.totalValueSol
            };
            
        } catch (error) {
            console.error('❌ Failed to take end snapshot:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

/**
     * Process tournament start - take snapshots for all participants
     */
    async processTournamentStart(tournamentInstanceId) {
        console.log(`🏁 Processing tournament start for instance ${tournamentInstanceId}`);
        
        try {
            // Get all registered participants
            const entriesResult = await this.api.getTournamentEntries(tournamentInstanceId);
            
            if (!entriesResult.success) {
                throw new Error('Failed to get tournament entries');
            }
            
            const entries = entriesResult.entries || [];
            
            if (entries.length === 0) {
                console.log('ℹ️ No participants to snapshot for this tournament');
                return {
                    successful: 0,
                    failed: 0,
                    errors: [],
                    message: 'No participants registered'
                };
            }
            
            console.log(`📊 Found ${entries.length} participants to snapshot`);
            
            const results = {
                successful: 0,
                failed: 0,
                errors: []
            };
            
            // Process snapshots in batches to avoid rate limits
            const batchSize = 5;
            for (let i = 0; i < entries.length; i += batchSize) {
                const batch = entries.slice(i, i + batchSize);
                
                const batchPromises = batch.map(entry => 
                    this.takeStartSnapshot(entry.id, entry.wallet_address)
                        .then(result => {
                            if (result.success) {
                                results.successful++;
                            } else {
                                results.failed++;
                                results.errors.push({
                                    entryId: entry.id,
                                    error: result.error
                                });
                            }
                            return result;
                        })
                );
                
                await Promise.all(batchPromises);
                
                // Small delay between batches
                if (i + batchSize < entries.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            console.log(`✅ Tournament start processing complete: ${results.successful} successful, ${results.failed} failed`);
            
            return results;
            
        } catch (error) {
            console.error('❌ Failed to process tournament start:', error);
            return {
                successful: 0,
                failed: 0,
                errors: [{ error: error.message }],
                message: error.message
            };
        }
    }

    /**
     * Process tournament end - take end snapshots and calculate results
     */
    async processTournamentEnd(tournamentInstanceId) {
        console.log(`🏁 Processing tournament end for instance ${tournamentInstanceId}`);
        
        try {
            // Get all participants with start snapshots
            const entriesResult = await this.api.getTournamentEntries(tournamentInstanceId);
            
            if (!entriesResult.success) {
                throw new Error('Failed to get tournament entries');
            }
            
            const entries = entriesResult.entries.filter(e => e.start_snapshot_id);
            console.log(`📊 Found ${entries.length} participants to process`);
            
            const results = [];
            
            // Process each entry
            for (const entry of entries) {
                try {
                    // Take end snapshot
                    const endSnapshot = await this.takeEndSnapshot(entry.id, entry.wallet_address);
                    
                    if (!endSnapshot.success) {
                        console.error(`Failed to take end snapshot for entry ${entry.id}`);
                        continue;
                    }
                    
                    // Get start snapshot from database
                    const startSnapshotData = await this.api.getSnapshot(entry.start_snapshot_id);
                    
                    // Calculate performance
                    const performance = this.calculatePerformance(
                        startSnapshotData.total_value_sol,
                        endSnapshot.totalValue
                    );
                    
                    // Check for cheating
                    const antiCheatResult = await this.runAntiCheatChecks(
                        entry,
                        startSnapshotData,
                        endSnapshot.snapshot
                    );
                    
                    results.push({
                        entryId: entry.id,
                        championId: entry.champion_id,
                        startValue: startSnapshotData.total_value_sol,
                        endValue: endSnapshot.totalValue,
                        performance: performance,
                        antiCheat: antiCheatResult,
                        isDisqualified: !antiCheatResult.passed
                    });
                    
                    // Update tournament entry with results
                    await this.api.updateTournamentEntryResults(entry.id, {
                        performance_percentage: performance,
                        final_value: endSnapshot.totalValue,
                        is_disqualified: !antiCheatResult.passed,
                        disqualification_reason: antiCheatResult.reason || null
                    });
                    
                } catch (error) {
                    console.error(`Error processing entry ${entry.id}:`, error);
                }
                
                // Small delay between entries
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Sort results by performance (excluding disqualified)
            const validResults = results.filter(r => !r.isDisqualified);
            validResults.sort((a, b) => b.performance - a.performance);
            
            // Assign rankings
            validResults.forEach((result, index) => {
                result.rank = index + 1;
            });
            
            console.log(`✅ Tournament end processing complete: ${results.length} participants processed`);
            
            return {
                success: true,
                results: results,
                rankings: validResults
            };
            
        } catch (error) {
            console.error('❌ Failed to process tournament end:', error);
            throw error;
        }
    }

    /**
     * Calculate performance percentage
     */
    calculatePerformance(startValue, endValue) {
        if (startValue === 0) return 0;
        
        const performance = ((endValue - startValue) / startValue) * 100;
        return Math.round(performance * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Run anti-cheat checks
     */
    async runAntiCheatChecks(entry, startSnapshot, endSnapshot) {
        console.log(`🔍 Running anti-cheat checks for entry ${entry.id}`);
        
        const checks = {
            passed: true,
            reason: null,
            flags: [],
            confidence: 0
        };
        
        try {
            // Check 1: Excessive gains
            const performance = this.calculatePerformance(
                startSnapshot.total_value_sol,
                endSnapshot.total_value_sol
            );
            
            const tournamentDuration = this.getTournamentDurationDays(entry);
            const maxAllowedGain = tournamentDuration <= 7 
                ? this.antiCheatConfig.maxWeeklyGainPercent 
                : this.antiCheatConfig.maxDailyGainPercent * tournamentDuration;
            
            if (performance > maxAllowedGain) {
                checks.flags.push({
                    type: 'excessive_gains',
                    severity: 'high',
                    details: `${performance}% gain exceeds maximum allowed ${maxAllowedGain}%`
                });
                checks.confidence += 40;
            }
            
            // Check 2: External deposits (compare SOL balance changes with transaction history)
            const solGain = endSnapshot.sol_balance - startSnapshot.sol_balance;
            if (solGain > startSnapshot.sol_balance * 0.5) {
                // More than 50% SOL increase is suspicious
                checks.flags.push({
                    type: 'suspicious_deposit',
                    severity: 'medium',
                    details: `SOL balance increased by ${solGain} SOL`
                });
                checks.confidence += 30;
            }
            
            // Check 3: Token balance anomalies
            const newTokens = this.detectNewTokens(
                startSnapshot.token_balances,
                endSnapshot.token_balances
            );
            
            if (newTokens.length > 5) {
                checks.flags.push({
                    type: 'multiple_new_tokens',
                    severity: 'medium',
                    details: `${newTokens.length} new tokens appeared`
                });
                checks.confidence += 20;
            }
            
            // Check 4: Timing manipulation (deposits near end)
            // This would require transaction history analysis
            // For now, flag if end value is significantly different from recent average
            
            // Determine if player should be disqualified
            if (checks.confidence >= 70) {
                checks.passed = false;
                checks.reason = checks.flags
                    .map(f => f.details)
                    .join('; ');
            }
            
            console.log(`✅ Anti-cheat check complete: ${checks.passed ? 'PASSED' : 'FAILED'}`);
            
        } catch (error) {
            console.error('❌ Anti-cheat check error:', error);
            // Don't disqualify on error, but flag for manual review
            checks.flags.push({
                type: 'check_error',
                severity: 'low',
                details: 'Anti-cheat verification failed'
            });
        }
        
        return checks;
    }

    /**
     * Detect new tokens that appeared during tournament
     */
    detectNewTokens(startTokens, endTokens) {
        const startMints = new Set(startTokens.map(t => t.mint));
        const newTokens = endTokens.filter(t => !startMints.has(t.mint));
        return newTokens;
    }

    /**
     * Get tournament duration in days
     */
    getTournamentDurationDays(entry) {
        // This would come from tournament data
        // For now, assume 7 days for weekly, 30 for monthly
        return 7; // Default to weekly
    }

    /**
     * Generate tournament performance report
     */
    async generateTournamentReport(tournamentInstanceId) {
        console.log(`📊 Generating tournament report for ${tournamentInstanceId}`);
        
        try {
            const results = await this.processTournamentEnd(tournamentInstanceId);
            
            const report = {
                tournamentId: tournamentInstanceId,
                timestamp: new Date().toISOString(),
                participants: results.results.length,
                validParticipants: results.rankings.length,
                disqualified: results.results.filter(r => r.isDisqualified).length,
                
                topPerformers: results.rankings.slice(0, 10).map(r => ({
                    rank: r.rank,
                    championId: r.championId,
                    performance: r.performance,
                    startValue: r.startValue,
                    endValue: r.endValue
                })),
                
                statistics: {
                    averagePerformance: this.calculateAverage(
                        results.rankings.map(r => r.performance)
                    ),
                    medianPerformance: this.calculateMedian(
                        results.rankings.map(r => r.performance)
                    ),
                    totalPrizePool: 0 // Calculate based on entry fees
                },
                
                antiCheatSummary: {
                    totalChecked: results.results.length,
                    flagged: results.results.filter(r => r.antiCheat.flags.length > 0).length,
                    disqualified: results.results.filter(r => r.isDisqualified).length
                }
            };
            
            return report;
            
        } catch (error) {
            console.error('❌ Failed to generate report:', error);
            throw error;
        }
    }

    /**
     * Calculate average
     */
    calculateAverage(numbers) {
        if (numbers.length === 0) return 0;
        const sum = numbers.reduce((a, b) => a + b, 0);
        return sum / numbers.length;
    }

    /**
     * Calculate median
     */
    calculateMedian(numbers) {
        if (numbers.length === 0) return 0;
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
    }
}

// Create global instance
window.tournamentSnapshotManager = new TournamentSnapshotManager();

// Export for use
window.TournamentSnapshotManager = TournamentSnapshotManager;

console.log('✅ Tournament Snapshot Manager loaded!');
console.log('📸 Snapshots will only be taken at tournament start/end to minimize API usage');
