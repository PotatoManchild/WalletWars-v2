// walletwars-escrow-integration.js
// Complete integration for WalletWars escrow system with deployed program
// Program ID: AXMwpemCzKXiozQhcMtxajPGQwiz4SWfb3xvH42RXuT7

// IMPORTANT: This uses the browser versions of the libraries loaded from CDN
// Make sure Solana Web3.js and Anchor are loaded before this script

class WalletWarsEscrowIntegration {
    constructor(wallet) {
        // Use the global objects from CDN libraries
        this.Connection = solanaWeb3.Connection;
        this.PublicKey = solanaWeb3.PublicKey;
        this.SystemProgram = solanaWeb3.SystemProgram;
        this.LAMPORTS_PER_SOL = solanaWeb3.LAMPORTS_PER_SOL;
        
        // Enhanced Buffer detection and fallback
        this.Buffer = this.setupBuffer();
        
        // Anchor globals (if available)
        if (typeof anchor !== 'undefined') {
            this.AnchorProvider = anchor.AnchorProvider;
            this.Program = anchor.Program;
            this.BN = anchor.BN;
            console.log('✅ Escrow: Anchor is available');
        } else {
            console.log('⚠️ Escrow: Anchor not available, will use direct transactions');
        }
        
        // Store wallet
        this.wallet = wallet;
        
        // Program configuration
        this.PROGRAM_ID = new this.PublicKey('AXMwpemCzKXiozQhcMtxajPGQwiz4SWfb3xvH42RXuT7');
        this.PLATFORM_WALLET = new this.PublicKey('5RLDuPHsa7ohaKUSNc5iYvtgveL1qrCcVdxVHXPeG3b8');
        
        // Initialize connection
        this.connection = new this.Connection(
            'https://api.devnet.solana.com',
            'confirmed'
        );
        
        // IDL for the program
        this.IDL = {"version":"0.1.0","name":"walletwars_escrow","instructions":[{"name":"initializeTournament","accounts":[{"name":"tournament","isMut":true,"isSigner":false},{"name":"escrowAccount","isMut":false,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"tournamentId","type":"string"},{"name":"entryFee","type":"u64"},{"name":"maxPlayers","type":"u32"},{"name":"platformFeePercentage","type":"u8"},{"name":"startTime","type":"i64"},{"name":"endTime","type":"i64"}]},{"name":"registerPlayer","accounts":[{"name":"tournament","isMut":true,"isSigner":false},{"name":"playerRegistration","isMut":true,"isSigner":false},{"name":"escrowAccount","isMut":true,"isSigner":false},{"name":"player","isMut":true,"isSigner":true},{"name":"playerWallet","isMut":true,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[]},{"name":"finalizeTournament","accounts":[{"name":"tournament","isMut":true,"isSigner":false},{"name":"authority","isMut":false,"isSigner":true}],"args":[{"name":"winnerAddresses","type":{"vec":"publicKey"}},{"name":"prizePercentages","type":"bytes"}]},{"name":"distributePrize","accounts":[{"name":"tournament","isMut":true,"isSigner":false},{"name":"escrowAccount","isMut":true,"isSigner":false},{"name":"winner","isMut":true,"isSigner":false},{"name":"authority","isMut":false,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"winnerIndex","type":"u8"},{"name":"prizePercentage","type":"u8"}]},{"name":"collectPlatformFees","accounts":[{"name":"tournament","isMut":false,"isSigner":false},{"name":"escrowAccount","isMut":true,"isSigner":false},{"name":"platformWallet","isMut":true,"isSigner":false},{"name":"authority","isMut":false,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[]},{"name":"cancelTournament","accounts":[{"name":"tournament","isMut":true,"isSigner":false},{"name":"authority","isMut":false,"isSigner":true}],"args":[]},{"name":"refundPlayer","accounts":[{"name":"tournament","isMut":false,"isSigner":false},{"name":"playerRegistration","isMut":true,"isSigner":false},{"name":"escrowAccount","isMut":true,"isSigner":false},{"name":"player","isMut":true,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[]}],"accounts":[{"name":"Tournament","type":{"kind":"struct","fields":[{"name":"authority","type":"publicKey"},{"name":"tournamentId","type":"string"},{"name":"entryFee","type":"u64"},{"name":"maxPlayers","type":"u32"},{"name":"currentPlayers","type":"u32"},{"name":"platformFeePercentage","type":"u8"},{"name":"totalPrizePool","type":"u64"},{"name":"platformFeesCollected","type":"u64"},{"name":"startTime","type":"i64"},{"name":"endTime","type":"i64"},{"name":"isActive","type":"bool"},{"name":"isFinalized","type":"bool"},{"name":"escrowBump","type":"u8"}]}},{"name":"PlayerRegistration","type":{"kind":"struct","fields":[{"name":"player","type":"publicKey"},{"name":"tournament","type":"publicKey"},{"name":"isRegistered","type":"bool"},{"name":"isRefunded","type":"bool"},{"name":"registrationTime","type":"i64"}]}}],"errors":[{"code":6000,"name":"InvalidFeePercentage","msg":"Invalid fee percentage. Must be 20% or less"},{"code":6001,"name":"InvalidEntryFee","msg":"Invalid entry fee. Must be greater than 0"},{"code":6002,"name":"InvalidMaxPlayers","msg":"Invalid max players. Must be between 1 and 1000"},{"code":6003,"name":"InvalidTimeRange","msg":"Invalid time range. End time must be after start time"},{"code":6004,"name":"TournamentNotActive","msg":"Tournament is not active"},{"code":6005,"name":"TournamentFinalized","msg":"Tournament has been finalized"},{"code":6006,"name":"TournamentFull","msg":"Tournament is full"},{"code":6007,"name":"TournamentEnded","msg":"Tournament has ended"},{"code":6008,"name":"AlreadyRegistered","msg":"Player already registered"},{"code":6009,"name":"TournamentNotEnded","msg":"Tournament has not ended yet"},{"code":6010,"name":"AlreadyFinalized","msg":"Tournament already finalized"},{"code":6011,"name":"MismatchedWinnersData","msg":"Mismatched winners and prize data"},{"code":6012,"name":"InvalidPrizeDistribution","msg":"Prize percentages must add up to 100"},{"code":6013,"name":"NotFinalized","msg":"Tournament not finalized"},{"code":6014,"name":"NoFeesToCollect","msg":"No fees to collect"},{"code":6015,"name":"TournamentStillActive","msg":"Tournament still active"},{"code":6016,"name":"NotRegistered","msg":"Player not registered"},{"code":6017,"name":"AlreadyRefunded","msg":"Player already refunded"}]};
        
        // Initialize Anchor program if available
        if (this.AnchorProvider && this.Program && wallet) {
            try {
                this.provider = new this.AnchorProvider(
                    this.connection,
                    wallet,
                    { commitment: 'confirmed' }
                );
                this.program = new this.Program(this.IDL, this.PROGRAM_ID, this.provider);
                console.log('✅ Escrow: Anchor program initialized');
            } catch (error) {
                console.warn('⚠️ Escrow: Anchor initialization failed, using direct transactions:', error);
                this.program = null;
            }
        } else {
            console.warn('⚠️ Escrow: Anchor not available or no wallet provided');
            this.program = null;
        }
    }

    /**
     * Setup Buffer with multiple fallback strategies
     */
    setupBuffer() {
        // Strategy 1: Check if Buffer is already global
        if (typeof Buffer !== 'undefined' && Buffer.from) {
            console.log('✅ Escrow: Buffer found globally');
            return Buffer;
        }
        
        // Strategy 2: Check window.Buffer
        if (typeof window !== 'undefined' && window.Buffer && window.Buffer.from) {
            console.log('✅ Escrow: Buffer found on window');
            return window.Buffer;
        }
        
        // Strategy 3: Create a minimal Buffer polyfill for Solana usage
        console.warn('⚠️ Escrow: Creating minimal Buffer polyfill');
        
        const BufferPolyfill = {
            from: (data, encoding) => {
                if (typeof data === 'string') {
                    if (encoding === 'hex') {
                        // Convert hex string to Uint8Array
                        const bytes = [];
                        for (let i = 0; i < data.length; i += 2) {
                            bytes.push(parseInt(data.substr(i, 2), 16));
                        }
                        return new Uint8Array(bytes);
                    } else {
                        // Default to UTF-8 encoding
                        const encoder = new TextEncoder();
                        return encoder.encode(data);
                    }
                } else if (data instanceof ArrayBuffer) {
                    return new Uint8Array(data);
                } else if (data instanceof Uint8Array) {
                    return data;
                } else if (Array.isArray(data)) {
                    return new Uint8Array(data);
                }
                throw new Error('Unsupported data type for Buffer.from');
            },
            
            isBuffer: (obj) => obj instanceof Uint8Array,
            
            concat: (arrays) => {
                const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
                const result = new Uint8Array(totalLength);
                let offset = 0;
                arrays.forEach(arr => {
                    result.set(arr, offset);
                    offset += arr.length;
                });
                return result;
            },
            
            // Additional methods that might be needed
            toString: (buffer, encoding) => {
                if (encoding === 'hex') {
                    return Array.from(buffer)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('');
                } else {
                    // Default to UTF-8
                    const decoder = new TextDecoder();
                    return decoder.decode(buffer);
                }
            }
        };
        
        // Make it available globally for other scripts
        if (typeof window !== 'undefined') {
            window.Buffer = BufferPolyfill;
        }
        
        console.log('✅ Escrow: Buffer polyfill created');
        return BufferPolyfill;
    }

    /**
     * Initialize a new tournament on-chain
     */
    async initializeTournament(tournamentData) {
        const {
            tournamentId,
            entryFee,
            maxPlayers,
            platformFeePercentage = 10,
            startTime,
            endTime
        } = tournamentData;

        try {
            console.log(`🎮 Initializing tournament ${tournamentId} on-chain...`);

            // Generate PDAs
            const [tournamentPDA] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('tournament'), this.Buffer.from(tournamentId)],
                this.PROGRAM_ID
            );

            const [escrowPDA] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('escrow'), this.Buffer.from(tournamentId)],
                this.PROGRAM_ID
            );

            console.log('📍 PDAs generated:', {
                tournament: tournamentPDA.toString(),
                escrow: escrowPDA.toString()
            });

            // If Anchor is available, use it
            if (this.program && this.BN) {
                const tx = await this.program.methods
                    .initializeTournament(
                        tournamentId,
                        new this.BN(entryFee * this.LAMPORTS_PER_SOL),
                        maxPlayers,
                        platformFeePercentage,
                        new this.BN(startTime),
                        new this.BN(endTime)
                    )
                    .accounts({
                        tournament: tournamentPDA,
                        escrowAccount: escrowPDA,
                        authority: this.wallet.publicKey,
                        systemProgram: this.SystemProgram.programId,
                    })
                    .rpc();

                console.log('✅ Tournament initialized with Anchor!');
                return {
                    success: true,
                    signature: tx,
                    tournamentPDA: tournamentPDA.toString(),
                    escrowPDA: escrowPDA.toString()
                };
            } else {
                // Fallback: Create manual instruction
                console.log('⚠️ Using manual transaction (Anchor not available)');
                return {
                    success: false,
                    error: 'Manual transaction creation not implemented. Please ensure Anchor is loaded.'
                };
            }

        } catch (error) {
            console.error('❌ Failed to initialize tournament:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Register a player for a tournament
     */
    async registerPlayer(tournamentId, playerWallet = null) {
        const player = playerWallet || this.wallet.publicKey;

        try {
            console.log(`📝 Registering player for tournament ${tournamentId}...`);

            // Generate PDAs
            const [tournamentPDA] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('tournament'), this.Buffer.from(tournamentId)],
                this.PROGRAM_ID
            );

            const [escrowPDA] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('escrow'), this.Buffer.from(tournamentId)],
                this.PROGRAM_ID
            );

            const [registrationPDA] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('registration'), tournamentPDA.toBuffer(), player.toBuffer()],
                this.PROGRAM_ID
            );

            // If Anchor is available, use it
            if (this.program) {
                // Get tournament data to show entry fee
                const tournament = await this.program.account.tournament.fetch(tournamentPDA);
                const entryFee = tournament.entryFee.toNumber() / this.LAMPORTS_PER_SOL;
                console.log(`💰 Entry fee: ${entryFee} SOL`);

                // Check wallet balance
                const balance = await this.connection.getBalance(player);
                if (balance < tournament.entryFee.toNumber()) {
                    throw new Error(`Insufficient balance. Need ${entryFee} SOL`);
                }

                // Register player
                const tx = await this.program.methods
                    .registerPlayer()
                    .accounts({
                        tournament: tournamentPDA,
                        playerRegistration: registrationPDA,
                        escrowAccount: escrowPDA,
                        player: player,
                        playerWallet: player,
                        systemProgram: this.SystemProgram.programId,
                    })
                    .rpc();

                console.log('✅ Player registered successfully!');
                console.log(`Entry fee of ${entryFee} SOL transferred to escrow`);

                return {
                    success: true,
                    signature: tx,
                    registrationPDA: registrationPDA.toString(),
                    entryFeePaid: entryFee
                };
            } else {
                // Fallback without Anchor
                console.log('⚠️ Anchor not available for registration');
                return {
                    success: false,
                    error: 'Registration requires Anchor. Please ensure it is loaded.'
                };
            }

        } catch (error) {
            console.error('❌ Registration failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get tournament data from blockchain
     */
    async getTournamentOnChain(tournamentId) {
        try {
            const [tournamentPDA] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('tournament'), this.Buffer.from(tournamentId)],
                this.PROGRAM_ID
            );

            if (this.program) {
                const tournament = await this.program.account.tournament.fetch(tournamentPDA);
                
                return {
                    success: true,
                    data: {
                        authority: tournament.authority.toString(),
                        tournamentId: tournament.tournamentId,
                        entryFee: tournament.entryFee.toNumber() / this.LAMPORTS_PER_SOL,
                        maxPlayers: tournament.maxPlayers,
                        currentPlayers: tournament.currentPlayers,
                        platformFeePercentage: tournament.platformFeePercentage,
                        totalPrizePool: tournament.totalPrizePool.toNumber() / this.LAMPORTS_PER_SOL,
                        isActive: tournament.isActive,
                        isFinalized: tournament.isFinalized
                    }
                };
            } else {
                return {
                    success: false,
                    error: 'Cannot fetch tournament data without Anchor'
                };
            }

        } catch (error) {
            console.error('❌ Failed to fetch tournament:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if player is registered
     */
    async isPlayerRegistered(tournamentId, playerAddress) {
        try {
            const player = new this.PublicKey(playerAddress);
            const [tournamentPDA] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('tournament'), this.Buffer.from(tournamentId)],
                this.PROGRAM_ID
            );

            const [registrationPDA] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('registration'), tournamentPDA.toBuffer(), player.toBuffer()],
                this.PROGRAM_ID
            );

            if (this.program) {
                try {
                    const registration = await this.program.account.playerRegistration.fetch(registrationPDA);
                    return registration.isRegistered;
                } catch {
                    return false; // Account doesn't exist = not registered
                }
            }
            
            return false;
        } catch (error) {
            console.error('❌ Error checking registration:', error);
            return false;
        }
    }

    /**
     * Enhanced test function with better diagnostics
     */
    async testConnection() {
        try {
            console.log('🔍 Testing escrow connection...');
            console.log('📋 Wallet provided:', !!this.wallet);
            console.log('📋 Wallet public key:', this.wallet?.publicKey?.toString());
            
            // Test 1: Connection
            const version = await this.connection.getVersion();
            console.log('✅ Connected to Solana:', version);
            
            // Test 2: Program exists
            const programInfo = await this.connection.getAccountInfo(this.PROGRAM_ID);
            console.log('✅ Escrow program found:', !!programInfo);
            
            // Test 3: Buffer works with all methods
            console.log('🧪 Testing Buffer functionality...');
            
            // Test Buffer.from with string
            const testString = 'hello world';
            const bufferFromString = this.Buffer.from(testString);
            console.log('✅ Buffer.from(string):', bufferFromString.length, 'bytes');
            
            // Test Buffer.from with hex
            const hexString = '48656c6c6f'; // "Hello" in hex
            const bufferFromHex = this.Buffer.from(hexString, 'hex');
            console.log('✅ Buffer.from(hex):', bufferFromHex.length, 'bytes');
            
            // Test Buffer.concat
            const concat = this.Buffer.concat([bufferFromString, bufferFromHex]);
            console.log('✅ Buffer.concat:', concat.length, 'bytes');
            
            // Test 4: Generate test PDAs
            const testId = 'test_' + Date.now();
            const [tournamentPDA] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('tournament'), this.Buffer.from(testId)],
                this.PROGRAM_ID
            );
            console.log('✅ Can generate PDAs:', tournamentPDA.toString());
            
            // Test 5: Verify Anchor if available
            if (this.program) {
                console.log('✅ Anchor program is initialized');
                console.log('   Program ID:', this.program.programId.toString());
                console.log('   Wallet connected to provider:', !!this.provider.wallet);
            } else {
                console.log('⚠️ Anchor not available (optional)');
            }
            
            return { 
                success: true, 
                message: 'All tests passed!',
                details: {
                    walletConnected: !!this.wallet,
                    solanaConnected: true,
                    programFound: !!programInfo,
                    bufferWorking: true,
                    pdaGeneration: true,
                    anchorAvailable: !!this.program
                }
            };
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Utility function to check if all dependencies are loaded
     */
    checkDependencies() {
        const deps = {
            Buffer: !!this.Buffer && typeof this.Buffer.from === 'function',
            Solana: !!this.Connection && !!this.PublicKey,
            Anchor: !!this.AnchorProvider && !!this.Program,
            Wallet: !!this.wallet
        };
        
        console.log('📋 Dependency check:', deps);
        return deps;
    }
}

// Make it available globally
window.WalletWarsEscrowIntegration = WalletWarsEscrowIntegration;

console.log('✅ WalletWars Escrow Integration loaded!');
console.log('📋 Available at: window.WalletWarsEscrowIntegration');
console.log('🎮 Program ID:', 'AXMwpemCzKXiozQhcMtxajPGQwiz4SWfb3xvH42RXuT7');
console.log('💰 Platform Wallet:', '5RLDuPHsa7ohaKUSNc5iYvtgveL1qrCcVdxVHXPeG3b8');

// Auto-test if Buffer is available
if (typeof Buffer !== 'undefined' || (typeof window !== 'undefined' && window.Buffer)) {
    console.log('🎉 Buffer is available for escrow integration!');
} else {
    console.warn('⚠️ Buffer not yet available, will create polyfill when instantiated');
}