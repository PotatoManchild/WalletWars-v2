// walletwars-api.js - ENHANCED VERSION WITH NEW WALLET SERVICE AND PROFILE METHODS
console.log('🎮 WalletWars API Loading with Enhanced Wallet Service...');

// ========================================
// SUPABASE CONFIGURATION
// ========================================

// ✅ CONFIGURED WITH YOUR ACTUAL SUPABASE PROJECT
const SUPABASE_URL = 'https://miwtcvcdpoqtqjbbvnxz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pd3RjdmNkcG9xdHFqYmJ2bnh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3Mjk4MTAsImV4cCI6MjA2NDMwNTgxMH0.5FCUjucAu2PxGEVc3X01dwa4wt4tHLewsjBO7s55Zt8';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase client initialized');

// ========================================
// WALLETWARS API CLASS WITH ENHANCED WALLET SERVICE
// ========================================

class WalletWarsAPI {
    constructor() {
        this.supabase = supabase;
        console.log('🏆 WalletWars API Ready with Enhanced Wallet Service Support!');
    }

    // ========================================
    // EXISTING METHODS (unchanged)
    // ========================================

    // Create wallet hash for privacy
    createWalletHash(walletAddress) {
        let hash = 0;
        const saltedAddress = walletAddress + 'walletwars_salt_2024';
        for (let i = 0; i < saltedAddress.length; i++) {
            const char = saltedAddress.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    // Test connection to database
    async testConnection() {
        try {
            console.log('🔌 Testing database connection...');
            const { data, error } = await this.supabase
                .from('achievement_definitions')
                .select('id')
                .limit(1);
            
            if (error) {
                console.error('❌ Database connection failed:', error);
                return false;
            }
            
            console.log('✅ Database connection successful!');
            return true;
        } catch (error) {
            console.error('❌ Connection test error:', error);
            return false;
        }
    }

    // Check if champion name already exists
    async checkChampionNameExists(championName) {
        try {
            console.log(`🔍 Checking if champion name "${championName}" exists...`);
            
            const { data, error } = await this.supabase
                .from('champions')
                .select('champion_name')
                .eq('is_active', true);

            if (error) {
                console.error('❌ Name check error:', error);
                return { success: false, error: error.message };
            }

            if (!data) {
                return { success: true, exists: false, championName: championName };
            }

            const matches = data.filter(champion => 
                champion.champion_name && 
                champion.champion_name.toLowerCase() === championName.toLowerCase()
            );

            const exists = matches.length > 0;
            
            console.log(`${exists ? '❌' : '✅'} Champion name "${championName}" ${exists ? 'already exists' : 'is available'}`);
            
            return { success: true, exists: exists, championName: championName };

        } catch (error) {
            console.error('❌ Name check exception:', error);
            return { success: false, error: error.message };
        }
    }

    // Create new champion
    async createChampion(walletAddress, championName, avatarEmoji = '🔥') {
        try {
            console.log(`🎯 Creating champion: ${championName}`);
            
            const walletHash = this.createWalletHash(walletAddress);
            
            // Check if name is still available
            const nameCheck = await this.checkChampionNameExists(championName);
            if (nameCheck.success && nameCheck.exists) {
                return { 
                    success: false, 
                    error: `Champion name "${championName}" is already taken.`
                };
            }
            
            // Check if champion already exists for this wallet
            const { data: existingChampion, error: checkError } = await this.supabase
                .from('champions')
                .select('id, champion_name, avatar_emoji')
                .eq('wallet_hash', walletHash)
                .single();

            if (existingChampion && !checkError) {
                return { 
                    success: false, 
                    error: 'Champion already exists for this wallet',
                    championId: existingChampion.id,
                    existingChampion: existingChampion
                };
            }

            // Create new champion
            const { data: newChampion, error: insertError } = await this.supabase
                .from('champions')
                .insert([{
                    wallet_hash: walletHash,
                    champion_name: championName,
                    avatar_emoji: avatarEmoji
                }])
                .select()
                .single();

            if (insertError) {
                console.error('❌ Create champion error:', insertError);
                return { success: false, error: insertError.message };
            }

            console.log('✅ Champion created successfully!', newChampion);

            // Initialize champion stats
            const { error: statsError } = await this.supabase
                .from('champion_stats')
                .insert([{
                    champion_id: newChampion.id,
                    tournaments_played: 0,
                    tournaments_won: 0,
                    total_sol_earned: 0,
                    current_win_streak: 0,
                    achievements_unlocked: 0,
                    total_achievement_points: 0
                }]);

            if (statsError) {
                console.warn('⚠️ Failed to initialize champion stats:', statsError);
            }

            return { 
                success: true, 
                championId: newChampion.id,
                champion: newChampion
            };

        } catch (error) {
            console.error('❌ Create champion exception:', error);
            return { success: false, error: error.message };
        }
    }

    // Get champion profile
    async getChampionProfile(walletAddress) {
        try {
            console.log('📋 Getting champion profile...');
            
            const walletHash = this.createWalletHash(walletAddress);
            
            const { data: champion, error: championError } = await this.supabase
                .from('champions')
                .select('*')
                .eq('wallet_hash', walletHash)
                .eq('is_active', true)
                .maybeSingle();

            if (championError) {
                console.error('❌ Get champion error:', championError);
                return { success: false, error: championError.message };
            }

            if (!champion) {
                return { success: false, error: 'No champion found' };
            }

            // Get stats separately
            const { data: stats, error: statsError } = await this.supabase
                .from('champion_stats')
                .select('*')
                .eq('champion_id', champion.id)
                .maybeSingle();

            if (statsError) {
                console.warn('⚠️ Could not load champion stats:', statsError);
            }

            const winRate = stats && stats.tournaments_played > 0 
                ? Math.round((stats.tournaments_won / stats.tournaments_played) * 100)
                : 0;

            const profileData = {
                champion_id: champion.id,
                champion_name: champion.champion_name,
                avatar_emoji: champion.avatar_emoji,
                created_at: champion.created_at,
                tournaments_played: stats?.tournaments_played || 0,
                tournaments_won: stats?.tournaments_won || 0,
                total_sol_earned: stats?.total_sol_earned || 0,
                current_win_streak: stats?.current_win_streak || 0,
                achievements_unlocked: stats?.achievements_unlocked || 0,
                total_achievement_points: stats?.total_achievement_points || 0,
                win_rate: winRate
            };

            console.log('✅ Champion profile loaded:', profileData);
            return { success: true, champion: profileData };

        } catch (error) {
            console.error('❌ Get profile exception:', error);
            return { success: false, error: error.message };
        }
    }

    // Check if champion exists
    async championExists(walletAddress) {
        const result = await this.getChampionProfile(walletAddress);
        return {
            exists: result.success,
            champion: result.success ? result.champion : null
        };
    }

    // Get all achievement definitions
    async getAchievementDefinitions() {
        try {
            console.log('🏆 Loading achievement definitions...');
            
            const { data, error } = await this.supabase
                .from('achievement_definitions')
                .select('*')
                .eq('is_active', true)
                .order('points', { ascending: true });

            if (error) {
                console.error('❌ Get achievements error:', error);
                return { success: false, error: error.message };
            }

            console.log(`✅ Loaded ${data.length} achievements`);
            return { success: true, achievements: data };
        } catch (error) {
            console.error('❌ Get achievements exception:', error);
            return { success: false, error: error.message };
        }
    }

    // Get leaderboard
    async getLeaderboard(limit = 100, offset = 0) {
        try {
            console.log('🏆 Loading leaderboard...');
            
            const { data, error } = await this.supabase
                .from('champions')
                .select(`
                    champion_name,
                    avatar_emoji,
                    champion_stats (
                        tournaments_played,
                        tournaments_won,
                        total_sol_earned,
                        current_win_streak,
                        achievements_unlocked
                    )
                `)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('❌ Get leaderboard error:', error);
                return { success: false, error: error.message };
            }

            const leaderboard = data
                .filter(champion => champion.champion_stats)
                .map((champion, index) => {
                    const stats = champion.champion_stats;
                    const winRate = stats.tournaments_played > 0 
                        ? Math.round((stats.tournaments_won / stats.tournaments_played) * 100)
                        : 0;

                    return {
                        rank: index + 1,
                        champion_name: champion.champion_name,
                        avatar_emoji: champion.avatar_emoji,
                        tournaments_played: stats.tournaments_played,
                        tournaments_won: stats.tournaments_won,
                        total_sol_earned: Number(stats.total_sol_earned),
                        current_win_streak: stats.current_win_streak,
                        achievements_unlocked: stats.achievements_unlocked,
                        win_rate: winRate
                    };
                })
                .sort((a, b) => {
                    if (b.tournaments_won !== a.tournaments_won) {
                        return b.tournaments_won - a.tournaments_won;
                    }
                    return b.total_sol_earned - a.total_sol_earned;
                })
                .map((champion, index) => ({
                    ...champion,
                    rank: index + 1
                }));

            console.log(`✅ Loaded leaderboard with ${leaderboard.length} champions`);
            return { success: true, leaderboard: leaderboard };
        } catch (error) {
            console.error('❌ Get leaderboard exception:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // TOURNAMENT METHODS
    // ========================================

    // Create tournament template
    async createTournamentTemplate(templateData) {
        try {
            console.log('🏆 Creating tournament template:', templateData.name);
            
            const { data, error } = await this.supabase
                .from('tournament_templates')
                .insert([templateData])
                .select()
                .single();

            if (error) {
                console.error('❌ Create template error:', error);
                return { success: false, error: error.message };
            }

            console.log('✅ Tournament template created successfully');
            return { success: true, template: data };
            
        } catch (error) {
            console.error('❌ Create template exception:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all active tournament templates
    async getTournamentTemplates() {
        try {
            const { data, error } = await this.supabase
                .from('tournament_templates')
                .select('*')
                .eq('is_active', true)
                .order('tournament_type', { ascending: true })
                .order('start_day', { ascending: true });

            if (error) {
                console.error('❌ Get templates error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, templates: data };
        } catch (error) {
            console.error('❌ Get templates exception:', error);
            return { success: false, error: error.message };
        }
    }

    // Create tournament instance from template
    async createTournamentInstance(instanceData) {
        try {
            console.log('🎮 Creating tournament instance');
            
            const { data, error } = await this.supabase
                .from('tournament_instances')
                .insert([instanceData])
                .select()
                .single();

            if (error) {
                console.error('❌ Create instance error:', error);
                return { success: false, error: error.message };
            }

            console.log('✅ Tournament instance created successfully');
            return { success: true, instance: data };
            
        } catch (error) {
            console.error('❌ Create instance exception:', error);
            return { success: false, error: error.message };
        }
    }

  // Get upcoming tournaments for display
async getUpcomingTournaments(limit = 50) {
    try {
        console.log('🔍 Fetching upcoming tournaments...');
        
        // First, let's check what tournaments exist in the database
        const { data: allTournaments, error: checkError } = await this.supabase
            .from('tournament_instances')
            .select('id, status, start_time, tournament_name')
            .order('created_at', { ascending: false })
            .limit(10);
            
        if (allTournaments) {
            console.log('📊 Sample tournaments in database:', allTournaments);
        }
        
        // Now get tournaments with full details - include ALL statuses to debug
        const { data, error } = await this.supabase
            .from('tournament_instances')
            .select(`
                *,
                tournament_templates (
                    name,
                    tournament_type,
                    trading_style,
                    start_day,
                    entry_fee,
                    max_participants,
                    prize_pool_percentage
                )
            `)
            .order('start_time', { ascending: true })
            .limit(limit);

        if (error) {
            console.error('❌ Get upcoming tournaments error:', error);
            return { success: false, error: error.message };
        }

        console.log(`📋 Found ${data?.length || 0} total tournaments`);
        
        // Log tournament statuses for debugging
        if (data && data.length > 0) {
            const statusCounts = data.reduce((acc, t) => {
                acc[t.status] = (acc[t.status] || 0) + 1;
                return acc;
            }, {});
            console.log('📊 Tournament status breakdown:', statusCounts);
        }

        return { success: true, tournaments: data || [] };
    } catch (error) {
        console.error('❌ Get upcoming tournaments exception:', error);
        return { success: false, error: error.message };
    }
}

    // Register champion for tournament
    async registerForTournament(championId, tournamentInstanceId, tradingStyle) {
        try {
            console.log(`🎯 Registering champion ${championId} for tournament ${tournamentInstanceId}`);
            
            // Get tournament details
            const tournamentResult = await this.supabase
                .from('tournament_instances')
                .select(`
                    *,
                    tournament_templates (*)
                `)
                .eq('id', tournamentInstanceId)
                .single();

            if (tournamentResult.error) {
                return { success: false, error: 'Tournament not found' };
            }

            const tournament = tournamentResult.data;
            
            // Validate registration is open
            if (tournament.status !== 'registering') {
                return { success: false, error: 'Registration is not open for this tournament' };
            }

            // Check if champion is already registered
            const existingEntry = await this.supabase
                .from('tournament_entries')
                .select('id')
                .eq('tournament_instance_id', tournamentInstanceId)
                .eq('champion_id', championId)
                .single();

            if (existingEntry.data) {
                return { success: false, error: 'Already registered for this tournament' };
            }

            // Get champion details
            const championResult = await this.supabase
                .from('champions')
                .select('wallet_hash')
                .eq('id', championId)
                .single();

            if (championResult.error) {
                return { success: false, error: 'Champion not found' };
            }

            // Create tournament entry
            const entryData = {
                tournament_instance_id: tournamentInstanceId,
                champion_id: championId,
                wallet_address: championResult.data.wallet_hash,
                entry_fee_paid: tournament.tournament_templates.entry_fee,
                trading_style_declared: tradingStyle,
                status: 'registered'
            };

            const { data, error } = await this.supabase
                .from('tournament_entries')
                .insert([entryData])
                .select()
                .single();

            if (error) {
                console.error('❌ Registration error:', error);
                return { success: false, error: error.message };
            }

            // Update tournament participant count
            await this.supabase
                .from('tournament_instances')
                .update({ 
                    participant_count: tournament.participant_count + 1,
                    total_prize_pool: (tournament.participant_count + 1) * tournament.tournament_templates.entry_fee * (tournament.tournament_templates.prize_pool_percentage / 100)
                })
                .eq('id', tournamentInstanceId);

            console.log('✅ Tournament registration successful');
            return { success: true, entry: data };
            
        } catch (error) {
            console.error('❌ Registration exception:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // ENHANCED WALLET SNAPSHOT METHODS
    // ========================================

    // Take wallet snapshot using enhanced wallet service
    async takeWalletSnapshot(walletAddress, tournamentEntryId, snapshotType) {
        try {
            console.log(`📸 Taking ${snapshotType} snapshot for wallet: ${walletAddress.substring(0, 8)}...`);
            
            // Use enhanced wallet service if available, fallback to original method
            const walletService = window.enhancedWalletService || window.solscanService;
            
            if (!walletService) {
                throw new Error('No wallet service available');
            }

            // Get wallet data using enhanced service
            const walletSnapshot = await walletService.getFullWalletSnapshot(walletAddress);
            
            console.log(`📊 Snapshot data:`, {
                solBalance: walletSnapshot.solBalance,
                tokenCount: walletSnapshot.tokenBalances.length,
                provider: walletSnapshot.provider || 'Unknown'
            });
            
            // Store in database
            const { data, error } = await this.supabase
                .from('wallet_snapshots')
                .insert([{
                    wallet_address: walletAddress,
                    tournament_entry_id: tournamentEntryId,
                    snapshot_type: snapshotType,
                    sol_balance: walletSnapshot.solBalance,
                    token_balances: walletSnapshot.tokenBalances,
                    total_value_sol: walletSnapshot.totalValueSol,
                    api_response: walletSnapshot.raw,
                    provider_used: walletSnapshot.provider || 'Enhanced Wallet Service'
                }])
                .select()
                .single();

            if (error) {
                console.error('❌ Failed to save snapshot:', error);
                return { success: false, error: error.message };
            }

            console.log(`✅ ${snapshotType} snapshot saved successfully (Provider: ${walletSnapshot.provider})`);
            return { success: true, snapshot: data };
            
        } catch (error) {
            console.error('❌ Snapshot error:', error);
            return { success: false, error: error.message };
        }
    }

    // Test wallet snapshot with enhanced service
    async testWalletSnapshot(walletAddress = null) {
        try {
            const testAddress = walletAddress || 'So11111111111111111111111111111111111111112';
            console.log(`🧪 Testing wallet snapshot for: ${testAddress.substring(0, 8)}...`);
            
            // Use enhanced wallet service if available
            const walletService = window.enhancedWalletService || window.solscanService;
            
            if (!walletService) {
                throw new Error('No wallet service available');
            }
            
            // Test getting a wallet snapshot
            const snapshot = await walletService.getFullWalletSnapshot(testAddress);
            
            console.log('✅ Enhanced wallet snapshot test results:');
            console.log('💰 SOL Balance:', snapshot.solBalance);
            console.log('🪙 Token Count:', snapshot.tokenBalances.length);
            console.log('💎 Total Value:', snapshot.totalValueSol, 'SOL');
            console.log('🔧 Provider:', snapshot.provider || 'Unknown');
            console.log('⏰ Timestamp:', snapshot.timestamp);
            
            return { success: true, snapshot: snapshot };
            
        } catch (error) {
            console.error('❌ Enhanced wallet snapshot test failed:', error);
            return { success: false, error: error.message };
        }
    }

  // Get tournament entries that need snapshots
    async getTournamentEntries(tournamentInstanceId) {
        try {
            const { data, error } = await this.supabase
                .from('tournament_entries')
                .select(`
                    *,
                    champions (
                        wallet_hash,
                        champion_name
                    )
                `)
                .eq('tournament_instance_id', tournamentInstanceId)
                .eq('status', 'registered');

            if (error) {
                console.error('❌ Get tournament entries error:', error);
                return { success: false, error: error.message };
            }

            // Handle empty results gracefully
            const entries = data || [];
            
            console.log(`📋 Found ${entries.length} tournament entries`);
            
            return { success: true, entries: entries };
        } catch (error) {
            console.error('❌ Get tournament entries exception:', error);
            return { success: false, error: error.message };
        }
    }

    // Update tournament entry with snapshot reference
    async updateTournamentEntrySnapshot(entryId, snapshotType, snapshotId) {
        try {
            const updateField = `${snapshotType}_snapshot_id`;
            
            const { data, error } = await this.supabase
                .from('tournament_entries')
                .update({ [updateField]: snapshotId })
                .eq('id', entryId)
                .select()
                .single();

            if (error) {
                console.error('❌ Update entry snapshot error:', error);
                return { success: false, error: error.message };
            }

            return { success: true, entry: data };
        } catch (error) {
            console.error('❌ Update entry snapshot exception:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // ENHANCED SERVICE STATUS
    // ========================================

    // Get comprehensive service status including wallet service
    async getEnhancedServiceStatus() {
        try {
            console.log('🔍 Checking enhanced service status...');
            
            const status = {
                database: false,
                walletService: false,
                walletServiceProvider: 'None',
                templates: 0,
                tournaments: 0,
                timestamp: new Date().toISOString()
            };
            
            // Test database
            status.database = await this.testConnection();
            
            // Test wallet service
            if (window.enhancedWalletService) {
                try {
                    const walletStatus = await window.enhancedWalletService.getServiceStatus();
                    status.walletService = walletStatus.online;
                    status.walletServiceProvider = walletStatus.provider;
                    status.walletServiceResponseTime = walletStatus.responseTime;
                } catch (error) {
                    console.warn('⚠️ Enhanced wallet service test failed:', error);
                }
            } else if (window.solscanService) {
                try {
                    const solscanStatus = await window.solscanService.getAPIStatus();
                    status.walletService = solscanStatus.online;
                    status.walletServiceProvider = 'Solscan (Fallback)';
                } catch (error) {
                    console.warn('⚠️ Solscan service test failed:', error);
                }
            }
            
            // Get template count
            if (status.database) {
                const templatesResult = await this.getTournamentTemplates();
                status.templates = templatesResult.success ? templatesResult.templates.length : 0;
                
                const tournamentsResult = await this.getUpcomingTournaments();
                status.tournaments = tournamentsResult.success ? tournamentsResult.tournaments.length : 0;
            }
            
            console.log('📊 Enhanced service status:', status);
            return status;
            
        } catch (error) {
            console.error('❌ Enhanced service status check failed:', error);
            return {
                database: false,
                walletService: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // ========================================
    // PROFILE PAGE METHODS
    // ========================================

    // Get all tournaments for a specific champion
    async getChampionTournaments(championId, limit = 50) {
        try {
            console.log(`🎮 Loading tournaments for champion ${championId}...`);
            
            const { data, error } = await this.supabase
                .from('tournament_entries')
                .select(`
                    *,
                    tournament_instances (
                        *,
                        tournament_templates (
                            name,
                            tournament_type,
                            trading_style,
                            entry_fee,
                            prize_pool_percentage
                        )
                    ),
                    start_snapshot:wallet_snapshots!tournament_entries_start_snapshot_id_fkey (
                        total_value_sol,
                        sol_balance,
                        snapshot_type
                    ),
                    end_snapshot:wallet_snapshots!tournament_entries_end_snapshot_id_fkey (
                        total_value_sol,
                        sol_balance,
                        snapshot_type
                    )
                `)
                .eq('champion_id', championId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('❌ Get champion tournaments error:', error);
                return { success: false, error: error.message };
            }

            // Process tournament data to calculate performance
            const processedTournaments = data.map(entry => {
                const tournament = entry.tournament_instances;
                const template = tournament?.tournament_templates;
                
                // Calculate performance if snapshots exist
                let performance = null;
                let performancePercentage = null;
                if (entry.start_snapshot && entry.end_snapshot) {
                    const startValue = entry.start_snapshot.total_value_sol;
                    const endValue = entry.end_snapshot.total_value_sol;
                    performance = endValue - startValue;
                    performancePercentage = ((endValue - startValue) / startValue * 100).toFixed(2);
                }
                
                return {
                    id: entry.id,
                    tournamentId: tournament?.id,
                    name: template?.name || 'Unknown Tournament',
                    tournamentType: template?.tournament_type,
                    tradingStyle: template?.trading_style,
                    status: tournament?.status || 'unknown',
                    rank: entry.final_rank || null,
                    performance: performancePercentage,
                    performanceValue: performance,
                    prizesWon: entry.prize_won || 0,
                    entryFee: entry.entry_fee_paid || 0,
                    startTime: tournament?.start_time,
                    endTime: tournament?.end_time,
                    participantCount: tournament?.participant_count || 0,
                    isDisqualified: entry.is_disqualified || false,
                    disqualificationReason: entry.disqualification_reason
                };
            });

            console.log(`✅ Loaded ${processedTournaments.length} tournaments for champion`);
            return { success: true, tournaments: processedTournaments };
            
        } catch (error) {
            console.error('❌ Get champion tournaments exception:', error);
            return { success: false, error: error.message };
        }
    }

    // Get champion's achievement progress
    async getChampionAchievements(championId) {
        try {
            console.log(`🏆 Loading achievements for champion ${championId}...`);
            
            // First get all achievement definitions
            const { data: definitions, error: defError } = await this.supabase
                .from('achievement_definitions')
                .select('*')
                .eq('is_active', true);

            if (defError) {
                throw defError;
            }

            // Then get champion's unlocked achievements
            const { data: unlocked, error: unlockError } = await this.supabase
                .from('champion_achievements')
                .select('*')
                .eq('champion_id', championId);

            if (unlockError) {
                throw unlockError;
            }

            // Create a map of unlocked achievements
            const unlockedMap = new Map();
            unlocked.forEach(achievement => {
                unlockedMap.set(achievement.achievement_id, achievement);
            });

            // Combine definitions with unlock status
            const achievementsWithProgress = definitions.map(definition => {
                const isUnlocked = unlockedMap.has(definition.id);
                const unlockedData = unlockedMap.get(definition.id);
                
                return {
                    ...definition,
                    isUnlocked: isUnlocked,
                    unlockedAt: unlockedData?.unlocked_at || null,
                    progress: unlockedData?.progress || 0
                };
            });

            // Calculate category progress
            const categoryProgress = {};
            achievementsWithProgress.forEach(achievement => {
                if (!categoryProgress[achievement.category]) {
                    categoryProgress[achievement.category] = {
                        total: 0,
                        unlocked: 0,
                        points: 0,
                        totalPoints: 0
                    };
                }
                
                categoryProgress[achievement.category].total++;
                categoryProgress[achievement.category].totalPoints += achievement.points;
                
                if (achievement.isUnlocked) {
                    categoryProgress[achievement.category].unlocked++;
                    categoryProgress[achievement.category].points += achievement.points;
                }
            });

            console.log(`✅ Loaded ${achievementsWithProgress.length} achievements with progress`);
            return { 
                success: true, 
                achievements: achievementsWithProgress,
                categoryProgress: categoryProgress
            };
            
        } catch (error) {
            console.error('❌ Get champion achievements exception:', error);
            return { success: false, error: error.message };
        }
    }

    // Get champion's performance statistics
    async getChampionStats(championId) {
        try {
            console.log(`📊 Loading performance stats for champion ${championId}...`);
            
            // Get all completed tournaments with performance data
            const { data, error } = await this.supabase
                .from('tournament_entries')
                .select(`
                    performance_percentage,
                    final_rank,
                    prize_won,
                    entry_fee_paid,
                    is_disqualified,
                    tournament_instances!inner (
                        participant_count,
                        status
                    )
                `)
                .eq('champion_id', championId)
                .eq('tournament_instances.status', 'complete')
                .not('performance_percentage', 'is', null);

            if (error) {
                throw error;
            }

            // Calculate statistics
            const stats = {
                totalTournaments: data.length,
                averagePerformance: 0,
                bestPerformance: 0,
                worstPerformance: 0,
                averageRank: 0,
                totalProfitLoss: 0,
                totalPrizesWon: 0,
                totalEntryFees: 0,
                topThreeFinishes: 0,
                disqualifications: 0
            };

            if (data.length > 0) {
                let performanceSum = 0;
                let rankSum = 0;
                let validRankCount = 0;

                data.forEach(entry => {
                    // Performance stats
                    const perf = parseFloat(entry.performance_percentage || 0);
                    performanceSum += perf;
                    
                    if (perf > stats.bestPerformance) {
                        stats.bestPerformance = perf;
                    }
                    if (stats.worstPerformance === 0 || perf < stats.worstPerformance) {
                        stats.worstPerformance = perf;
                    }

                    // Rank stats
                    if (entry.final_rank) {
                        rankSum += entry.final_rank;
                        validRankCount++;
                        
                        if (entry.final_rank <= 3) {
                            stats.topThreeFinishes++;
                        }
                    }

                    // Financial stats
                    stats.totalPrizesWon += parseFloat(entry.prize_won || 0);
                    stats.totalEntryFees += parseFloat(entry.entry_fee_paid || 0);
                    
                    // Disqualifications
                    if (entry.is_disqualified) {
                        stats.disqualifications++;
                    }
                });

                stats.averagePerformance = (performanceSum / data.length).toFixed(2);
                stats.averageRank = validRankCount > 0 ? (rankSum / validRankCount).toFixed(1) : null;
                stats.totalProfitLoss = stats.totalPrizesWon - stats.totalEntryFees;
            }

            console.log('✅ Calculated champion performance statistics');
            return { success: true, stats: stats };
            
        } catch (error) {
            console.error('❌ Get champion stats exception:', error);
            return { success: false, error: error.message };
        }
    }

    // Update tournament entry results (for automation system)
    async updateTournamentEntryResults(entryId, results) {
        try {
            const { data, error } = await this.supabase
                .from('tournament_entries')
                .update({
                    performance_percentage: results.performance_percentage,
                    final_value: results.final_value,
                    final_rank: results.final_rank,
                    prize_won: results.prize_won,
                    is_disqualified: results.is_disqualified,
                    disqualification_reason: results.disqualification_reason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', entryId)
                .select()
                .single();

            if (error) throw error;
            
            return { success: true, entry: data };
        } catch (error) {
            console.error('❌ Update tournament entry results error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get specific wallet snapshot
    async getSnapshot(snapshotId) {
        try {
            const { data, error } = await this.supabase
                .from('wallet_snapshots')
                .select('*')
                .eq('id', snapshotId)
                .single();

            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('❌ Get snapshot error:', error);
            throw error;
        }
    }
}

// ========================================
// GLOBAL API INSTANCE
// ========================================

// Create the API instance that your website will use
window.walletWarsAPI = new WalletWarsAPI();

// Test the connection when the script loads
window.walletWarsAPI.testConnection().then(connected => {
    if (connected) {
        console.log('🎮 WalletWars database ready for tournaments!');
        
        // Test enhanced wallet service if available
        setTimeout(async () => {
            if (window.enhancedWalletService) {
                try {
                    const testResult = await window.walletWarsAPI.testWalletSnapshot();
                    if (testResult.success) {
                        console.log('🚀 Enhanced wallet service integration successful!');
                    }
                } catch (error) {
                    console.warn('⚠️ Enhanced wallet service test failed:', error);
                }
            }
        }, 2000);
        
    } else {
        console.error('🚨 Database connection failed - check your configuration!');
    }
});

console.log('🚀 WalletWars API with Enhanced Wallet Service and Profile Methods loaded successfully!');
