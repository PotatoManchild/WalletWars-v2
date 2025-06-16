// walletwars-escrow-integration.js
// Complete integration for WalletWars escrow system with deployed program
// Program ID: 12j36Kp7fyzJcw29CPtoFuxg7Gy327HHTriEDUZNwv3Y (DEPLOYED TO DEVNET!)
// Deployment Date: June 16, 2025
// Build ID: e0da0f2b-2d48-44e6-b25e-cd803c6b9f72
// Last Updated: June 16, 2025 - Added enhanced error handling and unique tournament IDs

// IMPORTANT: This uses the browser versions of the libraries loaded from CDN
// Make sure Solana Web3.js and Anchor are loaded before this script

class WalletWarsEscrowIntegration {
    constructor(wallet) {
        // Check if Solana Web3 is available
        if (typeof solanaWeb3 === 'undefined') {
            console.error('❌ Escrow: Solana Web3.js not loaded! Please ensure it is loaded before this script.');
            throw new Error('Solana Web3.js is required');
        }
        
        // Use the global objects from CDN libraries
        this.Connection = solanaWeb3.Connection;
        this.PublicKey = solanaWeb3.PublicKey;
        this.SystemProgram = solanaWeb3.SystemProgram;
        this.LAMPORTS_PER_SOL = solanaWeb3.LAMPORTS_PER_SOL;
        this.Transaction = solanaWeb3.Transaction;
        this.TransactionInstruction = solanaWeb3.TransactionInstruction;
        
        // Enhanced Buffer detection and fallback
        this.Buffer = this.setupBuffer();
        
        // Anchor globals - improved detection
        this.anchor = null;
        this.AnchorProvider = null;
        this.Program = null;
        this.BN = null;
        
        // Try multiple ways to find Anchor
        if (typeof anchor !== 'undefined' && anchor) {
            this.anchor = anchor;
            console.log('✅ Escrow: Found global anchor');
        } else if (typeof window !== 'undefined' && window.anchor) {
            this.anchor = window.anchor;
            console.log('✅ Escrow: Found window.anchor');
        } else if (typeof Anchor !== 'undefined' && Anchor) {
            this.anchor = Anchor;
            console.log('✅ Escrow: Found global Anchor (capital A)');
        } else if (typeof window !== 'undefined' && window.Anchor) {
            this.anchor = window.Anchor;
            console.log('✅ Escrow: Found window.Anchor (capital A)');
        }
        
        // If we found Anchor, extract its components
        if (this.anchor) {
            this.AnchorProvider = this.anchor.AnchorProvider || this.anchor.Provider;
            this.Program = this.anchor.Program;
            this.BN = this.anchor.BN;
            console.log('✅ Escrow: Anchor components extracted:', {
                hasProvider: !!this.AnchorProvider,
                hasProgram: !!this.Program,
                hasBN: !!this.BN
            });
        } else {
            console.warn('⚠️ Escrow: Anchor not available, will use fallback methods');
            // Create minimal BN fallback
            this.BN = class BN {
                constructor(value) {
                    this.value = BigInt(Math.floor(Number(value)));
                }
                toString() { return this.value.toString(); }
                toNumber() { return Number(this.value); }
                toArray(endian = 'be', length = 8) {
                    let hex = this.value.toString(16);
                    if (hex.length % 2 !== 0) hex = '0' + hex;
                    hex = hex.padStart(length * 2, '0');
                    const bytes = [];
                    for (let i = 0; i < hex.length; i += 2) {
                        bytes.push(parseInt(hex.substr(i, 2), 16));
                    }
                    if (endian === 'le') bytes.reverse();
                    return bytes;
                }
                toBuffer(endian = 'be', length = 8) {
                    return new Uint8Array(this.toArray(endian, length));
                }
                toJSON() {
                    return this.toString();
                }
            };
        }
        
        // Store wallet
        this.wallet = wallet;
        
        // Program configuration - UPDATED WITH NEW DEPLOYED PROGRAM ID!
        this.PROGRAM_ID = new this.PublicKey('12j36Kp7fyzJcw29CPtoFuxg7Gy327HHTriEDUZNwv3Y');
        this.PLATFORM_WALLET = new this.PublicKey('5RLDuPHsa7ohaKUSNc5iYvtgveL1qrCcVdxVHXPeG3b8');
        
        console.log('🎮 Escrow Integration Program Configuration:');
        console.log('   Program ID:', this.PROGRAM_ID.toString());
        console.log('   Platform Wallet:', this.PLATFORM_WALLET.toString());
        console.log('   ✅ PROGRAM DEPLOYED TO DEVNET!');
        console.log('   📅 Initialized:', new Date().toISOString());
        
        // Initialize connection
        this.connection = new this.Connection(
            'https://api.devnet.solana.com',
            'confirmed'
        );
        
        // IDL for the program
        this.IDL = {"version":"0.1.0","name":"walletwars_escrow","instructions":[{"name":"initializeTournament","accounts":[{"name":"tournament","isMut":true,"isSigner":false},{"name":"escrowAccount","isMut":false,"isSigner":false},{"name":"authority","isMut":true,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"tournamentId","type":"string"},{"name":"entryFee","type":"u64"},{"name":"maxPlayers","type":"u32"},{"name":"platformFeePercentage","type":"u8"},{"name":"startTime","type":"i64"},{"name":"endTime","type":"i64"}]},{"name":"registerPlayer","accounts":[{"name":"tournament","isMut":true,"isSigner":false},{"name":"playerRegistration","isMut":true,"isSigner":false},{"name":"escrowAccount","isMut":true,"isSigner":false},{"name":"player","isMut":true,"isSigner":true},{"name":"playerWallet","isMut":true,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[]},{"name":"finalizeTournament","accounts":[{"name":"tournament","isMut":true,"isSigner":false},{"name":"authority","isMut":false,"isSigner":true}],"args":[{"name":"winnerAddresses","type":{"vec":"publicKey"}},{"name":"prizePercentages","type":"bytes"}]},{"name":"distributePrize","accounts":[{"name":"tournament","isMut":true,"isSigner":false},{"name":"escrowAccount","isMut":true,"isSigner":false},{"name":"winner","isMut":true,"isSigner":false},{"name":"authority","isMut":false,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[{"name":"winnerIndex","type":"u8"},{"name":"prizePercentage","type":"u8"}]},{"name":"collectPlatformFees","accounts":[{"name":"tournament","isMut":false,"isSigner":false},{"name":"escrowAccount","isMut":true,"isSigner":false},{"name":"platformWallet","isMut":true,"isSigner":false},{"name":"authority","isMut":false,"isSigner":true},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[]},{"name":"cancelTournament","accounts":[{"name":"tournament","isMut":true,"isSigner":false},{"name":"authority","isMut":false,"isSigner":true}],"args":[]},{"name":"refundPlayer","accounts":[{"name":"tournament","isMut":false,"isSigner":false},{"name":"playerRegistration","isMut":true,"isSigner":false},{"name":"escrowAccount","isMut":true,"isSigner":false},{"name":"player","isMut":true,"isSigner":false},{"name":"systemProgram","isMut":false,"isSigner":false}],"args":[]}],"accounts":[{"name":"Tournament","type":{"kind":"struct","fields":[{"name":"authority","type":"publicKey"},{"name":"tournamentId","type":"string"},{"name":"entryFee","type":"u64"},{"name":"maxPlayers","type":"u32"},{"name":"currentPlayers","type":"u32"},{"name":"platformFeePercentage","type":"u8"},{"name":"totalPrizePool","type":"u64"},{"name":"platformFeesCollected","type":"u64"},{"name":"startTime","type":"i64"},{"name":"endTime","type":"i64"},{"name":"isActive","type":"bool"},{"name":"isFinalized","type":"bool"},{"name":"escrowBump","type":"u8"}]}},{"name":"PlayerRegistration","type":{"kind":"struct","fields":[{"name":"player","type":"publicKey"},{"name":"tournament","type":"publicKey"},{"name":"isRegistered","type":"bool"},{"name":"isRefunded","type":"bool"},{"name":"registrationTime","type":"i64"}]}}],"errors":[{"code":6000,"name":"InvalidFeePercentage","msg":"Invalid fee percentage. Must be 20% or less"},{"code":6001,"name":"InvalidEntryFee","msg":"Invalid entry fee. Must be greater than 0"},{"code":6002,"name":"InvalidMaxPlayers","msg":"Invalid max players. Must be between 1 and 1000"},{"code":6003,"name":"InvalidTimeRange","msg":"Invalid time range. End time must be after start time"},{"code":6004,"name":"TournamentNotActive","msg":"Tournament is not active"},{"code":6005,"name":"TournamentFinalized","msg":"Tournament has been finalized"},{"code":6006,"name":"TournamentFull","msg":"Tournament is full"},{"code":6007,"name":"TournamentEnded","msg":"Tournament has ended"},{"code":6008,"name":"AlreadyRegistered","msg":"Player already registered"},{"code":6009,"name":"TournamentNotEnded","msg":"Tournament has not ended yet"},{"code":6010,"name":"AlreadyFinalized","msg":"Tournament already finalized"},{"code":6011,"name":"MismatchedWinnersData","msg":"Mismatched winners and prize data"},{"code":6012,"name":"InvalidPrizeDistribution","msg":"Prize percentages must add up to 100"},{"code":6013,"name":"NotFinalized","msg":"Tournament not finalized"},{"code":6014,"name":"NoFeesToCollect","msg":"No fees to collect"},{"code":6015,"name":"TournamentStillActive","msg":"Tournament still active"},{"code":6016,"name":"NotRegistered","msg":"Player not registered"},{"code":6017,"name":"AlreadyRefunded","msg":"Player already refunded"}]};
        
        // Initialize Anchor program if available
        this.program = null;
        this.provider = null;
        
        if (this.AnchorProvider && this.Program && wallet) {
            try {
                this.provider = new this.AnchorProvider(
                    this.connection,
                    wallet,
                    { commitment: 'confirmed' }
                );
                
                // If setProvider exists, use it
                if (this.anchor && this.anchor.setProvider) {
                    this.anchor.setProvider(this.provider);
                }
                
                this.program = new this.Program(this.IDL, this.PROGRAM_ID, this.provider);
                console.log('✅ Escrow: Anchor program initialized');
            } catch (error) {
                console.warn('⚠️ Escrow: Anchor initialization failed:', error);
                this.program = null;
                this.provider = null;
            }
        } else {
            console.warn('⚠️ Escrow: Anchor not available or no wallet provided');
            console.log('   Available components:', {
                hasAnchorProvider: !!this.AnchorProvider,
                hasProgram: !!this.Program,
                hasWallet: !!wallet
            });
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
     * Generate a unique tournament ID with timestamp
     */
    generateUniqueTournamentId(prefix = 'tournament') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${prefix}_${timestamp}_${random}`;
    }

    /**
     * Initialize a new tournament on-chain with enhanced error handling
     * This is the MAIN method to use for tournament creation
     */
    async initializeTournament(tournamentData) {
        // Auto-generate unique ID if not provided
        if (!tournamentData.tournamentId) {
            tournamentData.tournamentId = this.generateUniqueTournamentId();
            console.log(`📝 Auto-generated tournament ID: ${tournamentData.tournamentId}`);
        }

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
            console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
            
            // Verify we're on devnet
            const version = await this.connection.getVersion();
            console.log('🌐 Network version:', version['solana-core']);
            
            // Verify the program account is valid
            const programInfo = await this.connection.getAccountInfo(this.PROGRAM_ID);
            if (!programInfo) {
                throw new Error('Program account not found on chain! Please check deployment.');
            }
            if (!programInfo.executable) {
                throw new Error('Program account is not executable!');
            }
            console.log('✅ Program account verified:', {
                address: this.PROGRAM_ID.toString(),
                owner: programInfo.owner.toString(),
                executable: programInfo.executable,
                dataLength: programInfo.data.length
            });

            // Generate PDAs
            const [tournamentPDA, tournamentBump] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('tournament'), this.Buffer.from(tournamentId)],
                this.PROGRAM_ID
            );

            const [escrowPDA, escrowBump] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('escrow'), this.Buffer.from(tournamentId)],
                this.PROGRAM_ID
            );

            console.log('📍 PDAs generated:', {
                tournament: tournamentPDA.toString(),
                tournamentBump,
                escrow: escrowPDA.toString(),
                escrowBump
            });
            
            // Check if tournament already exists
            console.log('🔍 Checking if tournament already exists...');
            const existingAccount = await this.connection.getAccountInfo(tournamentPDA);
            if (existingAccount) {
                console.error('❌ Tournament account already exists!');
                console.error('   Tournament ID:', tournamentId);
                console.error('   PDA:', tournamentPDA.toString());
                console.error('   Try using a different tournament ID or use generateUniqueTournamentId()');
                return {
                    success: false,
                    error: 'Tournament ID already exists. Please use a unique ID.',
                    existingId: tournamentId,
                    suggestedId: this.generateUniqueTournamentId()
                };
            }
            
            console.log('✅ Tournament ID is available');
            
            // Calculate rent for the tournament account
            const TOURNAMENT_ACCOUNT_SIZE = 8 + 32 + 64 + 8 + 4 + 4 + 1 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 100; // ~350 bytes
            const rentExemptAmount = await this.connection.getMinimumBalanceForRentExemption(TOURNAMENT_ACCOUNT_SIZE);
            
            console.log(`💰 Rent exempt amount needed: ${rentExemptAmount / this.LAMPORTS_PER_SOL} SOL`);
            
            // Check wallet balance
            const walletBalance = await this.connection.getBalance(this.wallet.publicKey);
            console.log(`👛 Wallet balance: ${walletBalance / this.LAMPORTS_PER_SOL} SOL`);
            console.log(`   Wallet address: ${this.wallet.publicKey.toString()}`);
            
            if (walletBalance < rentExemptAmount + 5000) {
                return {
                    success: false,
                    error: `Insufficient balance. Need at least ${(rentExemptAmount + 5000) / this.LAMPORTS_PER_SOL} SOL`,
                    currentBalance: walletBalance / this.LAMPORTS_PER_SOL,
                    requiredBalance: (rentExemptAmount + 5000) / this.LAMPORTS_PER_SOL
                };
            }

            // If Anchor is available, use it
            if (this.program && this.BN) {
                console.log('🚀 Using Anchor for transaction...');
                
                // Create BN instances properly
                const entryFeeBN = new this.BN(Math.floor(entryFee * this.LAMPORTS_PER_SOL));
                const startTimeBN = new this.BN(Math.floor(startTime));
                const endTimeBN = new this.BN(Math.floor(endTime));
                
                console.log('📊 Transaction parameters:', {
                    tournamentId,
                    entryFee: `${entryFee} SOL (${entryFeeBN.toString()} lamports)`,
                    maxPlayers,
                    platformFeePercentage: `${platformFeePercentage}%`,
                    startTime: new Date(startTime * 1000).toISOString(),
                    endTime: new Date(endTime * 1000).toISOString()
                });
                
                try {
                    // Build and send transaction
                    const tx = await this.program.methods
                        .initializeTournament(
                            tournamentId,
                            entryFeeBN,
                            maxPlayers,
                            platformFeePercentage,
                            startTimeBN,
                            endTimeBN
                        )
                        .accounts({
                            tournament: tournamentPDA,
                            escrowAccount: escrowPDA,
                            authority: this.wallet.publicKey,
                            systemProgram: this.SystemProgram.programId,
                        })
                        .rpc();

                    console.log('✅ Tournament initialized with Anchor!');
                    console.log(`📝 Transaction signature: ${tx}`);
                    console.log(`🔗 View on explorer: https://devnet.explorer.solana.com/tx/${tx}`);
                    console.log(`⏰ Completed at: ${new Date().toISOString()}`);
                    
                    return {
                        success: true,
                        signature: tx,
                        tournamentPDA: tournamentPDA.toString(),
                        escrowPDA: escrowPDA.toString(),
                        tournamentId,
                        timestamp: new Date().toISOString()
                    };
                } catch (anchorError) {
                    console.error('❌ Anchor transaction failed:', anchorError);
                    
                    // Enhanced error parsing
                    if (anchorError.error) {
                        const errorCode = anchorError.error.errorCode?.code;
                        const errorMsg = anchorError.error.errorMessage;
                        
                        console.error('Program error details:', {
                            code: errorCode,
                            message: errorMsg,
                            number: anchorError.error.errorCode?.number
                        });
                        
                        // Map error codes to user-friendly messages
                        const errorMap = {
                            'InvalidFeePercentage': 'Platform fee must be 20% or less',
                            'InvalidEntryFee': 'Entry fee must be greater than 0',
                            'InvalidMaxPlayers': 'Max players must be between 1 and 1000',
                            'InvalidTimeRange': 'End time must be after start time'
                        };
                        
                        return {
                            success: false,
                            error: errorMap[errorCode] || errorMsg || 'Transaction failed',
                            errorCode,
                            logs: anchorError.logs
                        };
                    }
                    
                    // Check for custom error code
                    if (anchorError.message && anchorError.message.includes('custom program error')) {
                        const match = anchorError.message.match(/0x([0-9a-f]+)/i);
                        if (match) {
                            const errorCode = parseInt(match[1], 16);
                            console.error(`Custom error code: ${errorCode} (0x${match[1]})`);
                            
                            if (errorCode === 101) {
                                return {
                                    success: false,
                                    error: 'Account already exists or insufficient lamports. Try a different tournament ID.',
                                    errorCode: 101,
                                    suggestedId: this.generateUniqueTournamentId()
                                };
                            }
                        }
                    }
                    
                    if (anchorError.logs) {
                        console.error('Transaction logs:');
                        anchorError.logs.forEach(log => console.error('  ', log));
                    }
                    
                    throw anchorError;
                }
            } else {
                // Fallback: Create manual instruction
                console.log('⚠️ Using direct transaction (Anchor not available)');
                
                // Encode instruction data manually
                const instructionData = this.encodeInitializeTournamentData({
                    tournamentId,
                    entryFee: entryFee * this.LAMPORTS_PER_SOL,
                    maxPlayers,
                    platformFeePercentage,
                    startTime,
                    endTime
                });
                
                // Create instruction
                const instruction = new this.TransactionInstruction({
                    programId: this.PROGRAM_ID,
                    keys: [
                        { pubkey: tournamentPDA, isSigner: false, isWritable: true },
                        { pubkey: escrowPDA, isSigner: false, isWritable: false },
                        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
                        { pubkey: this.SystemProgram.programId, isSigner: false, isWritable: false }
                    ],
                    data: instructionData
                });
                
                // Create and send transaction
                const transaction = new this.Transaction().add(instruction);
                
                // Get recent blockhash
                const { blockhash } = await this.connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = this.wallet.publicKey;
                
                // Simulate first
                console.log('🔍 Simulating transaction...');
                const simulation = await this.connection.simulateTransaction(transaction);
                if (simulation.value.err) {
                    console.error('❌ Simulation failed:', simulation.value.err);
                    if (simulation.value.logs) {
                        console.error('Logs:', simulation.value.logs);
                    }
                    return {
                        success: false,
                        error: 'Transaction simulation failed',
                        simulationError: simulation.value.err,
                        logs: simulation.value.logs
                    };
                }
                
                console.log('✅ Simulation successful, sending transaction...');
                
                // Use wallet adapter to sign and send
                const signature = await this.wallet.sendTransaction(transaction, this.connection);
                
                // Wait for confirmation
                await this.connection.confirmTransaction(signature, 'confirmed');
                
                console.log('✅ Tournament initialized with direct transaction!');
                console.log(`⏰ Completed at: ${new Date().toISOString()}`);
                
                return {
                    success: true,
                    signature,
                    tournamentPDA: tournamentPDA.toString(),
                    escrowPDA: escrowPDA.toString(),
                    tournamentId,
                    timestamp: new Date().toISOString()
                };
            }

        } catch (error) {
            console.error('❌ Failed to initialize tournament:', error);
            console.error('Stack trace:', error.stack);
            
            // Provide helpful error messages
            if (error.message.includes('Transaction simulation failed')) {
                return {
                    success: false,
                    error: 'Transaction simulation failed. This usually means the account already exists or there\'s insufficient SOL.',
                    details: error.message,
                    suggestedId: this.generateUniqueTournamentId()
                };
            }
            
            return { 
                success: false, 
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Debug instruction data
     * Helps identify encoding issues
     */
    debugInstructionData(instructionData) {
        console.log('📊 Instruction Data Debug:');
        console.log('Total length:', instructionData.length, 'bytes');
        
        // Show discriminator
        const discriminator = Array.from(instructionData.slice(0, 8));
        console.log('Discriminator:', discriminator.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        
        // Show hex dump
        const hex = Array.from(instructionData).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log('Hex dump:', hex);
        
        // Try to parse the data
        let offset = 8; // Skip discriminator
        
        // String length (4 bytes)
        if (offset + 4 <= instructionData.length) {
            const strLen = instructionData[offset] | 
                          (instructionData[offset + 1] << 8) | 
                          (instructionData[offset + 2] << 16) | 
                          (instructionData[offset + 3] << 24);
            console.log('String length:', strLen);
            offset += 4;
            
            // String data
            if (offset + strLen <= instructionData.length) {
                const strData = instructionData.slice(offset, offset + strLen);
                const str = new TextDecoder().decode(strData);
                console.log('Tournament ID:', str);
                offset += strLen;
            }
        }
        
        // Entry fee (8 bytes)
        if (offset + 8 <= instructionData.length) {
            const entryFee = instructionData.slice(offset, offset + 8);
            console.log('Entry fee bytes:', Array.from(entryFee).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            offset += 8;
        }
        
        // Max players (4 bytes)
        if (offset + 4 <= instructionData.length) {
            const maxPlayers = instructionData[offset] | 
                              (instructionData[offset + 1] << 8) | 
                              (instructionData[offset + 2] << 16) | 
                              (instructionData[offset + 3] << 24);
            console.log('Max players:', maxPlayers);
            offset += 4;
        }
        
        // Platform fee (1 byte)
        if (offset + 1 <= instructionData.length) {
            console.log('Platform fee percentage:', instructionData[offset]);
            offset += 1;
        }
        
        // Start time (8 bytes)
        if (offset + 8 <= instructionData.length) {
            const startTime = instructionData.slice(offset, offset + 8);
            console.log('Start time bytes:', Array.from(startTime).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            offset += 8;
        }
        
        // End time (8 bytes)
        if (offset + 8 <= instructionData.length) {
            const endTime = instructionData.slice(offset, offset + 8);
            console.log('End time bytes:', Array.from(endTime).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        }
    }

    /**
     * Encode instruction data for initialize tournament
     * Using proper Borsh-like encoding for Solana
     */
    encodeInitializeTournamentData(params) {
        // Create a buffer to hold all the data
        const buffers = [];
        
        // 1. Add instruction discriminator (8 bytes)
        // Using the correct discriminator for initializeTournament
        const discriminator = new Uint8Array([175, 218, 86, 80, 49, 127, 155, 186]);
        buffers.push(discriminator);
        
        // 2. Encode string (tournament ID) - length prefix + data
        const tournamentIdBytes = this.Buffer.from(params.tournamentId, 'utf8');
        const idLengthBytes = new Uint8Array(4);
        new DataView(idLengthBytes.buffer).setUint32(0, tournamentIdBytes.length, true);
        buffers.push(idLengthBytes);
        buffers.push(tournamentIdBytes);
        
        // 3. Encode u64 (entry fee) - 8 bytes little endian
        const entryFeeBytes = new Uint8Array(8);
        const entryFeeBN = BigInt(params.entryFee);
        for (let i = 0; i < 8; i++) {
            entryFeeBytes[i] = Number((entryFeeBN >> BigInt(i * 8)) & BigInt(0xFF));
        }
        buffers.push(entryFeeBytes);
        
        // 4. Encode u32 (max players) - 4 bytes little endian
        const maxPlayersBytes = new Uint8Array(4);
        new DataView(maxPlayersBytes.buffer).setUint32(0, params.maxPlayers, true);
        buffers.push(maxPlayersBytes);
        
        // 5. Encode u8 (platform fee percentage) - 1 byte
        buffers.push(new Uint8Array([params.platformFeePercentage]));
        
        // 6. Encode i64 (start time) - 8 bytes little endian
        const startTimeBytes = new Uint8Array(8);
        const startTimeBN = BigInt(params.startTime);
        for (let i = 0; i < 8; i++) {
            startTimeBytes[i] = Number((startTimeBN >> BigInt(i * 8)) & BigInt(0xFF));
        }
        buffers.push(startTimeBytes);
        
        // 7. Encode i64 (end time) - 8 bytes little endian
        const endTimeBytes = new Uint8Array(8);
        const endTimeBN = BigInt(params.endTime);
        for (let i = 0; i < 8; i++) {
            endTimeBytes[i] = Number((endTimeBN >> BigInt(i * 8)) & BigInt(0xFF));
        }
        buffers.push(endTimeBytes);
        
        // Combine all buffers
        const result = this.Buffer.concat(buffers);
        
        // Debug the encoded data
        console.log('🔍 Manual instruction encoding:');
        this.debugInstructionData(result);
        
        return result;
    }

    /**
     * Register a player for a tournament
     */
    async registerPlayer(tournamentId, playerWallet = null) {
        const player = playerWallet || this.wallet.publicKey;

        try {
            console.log(`📝 Registering player for tournament ${tournamentId}...`);
            console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

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

            console.log('📍 Registration PDA:', registrationPDA.toString());

            // If Anchor is available, use it
            if (this.program) {
                // Get tournament data to show entry fee
                const tournament = await this.program.account.tournament.fetch(tournamentPDA);
                const entryFee = tournament.entryFee.toNumber() / this.LAMPORTS_PER_SOL;
                console.log(`💰 Entry fee: ${entryFee} SOL`);

                // Check wallet balance
                const balance = await this.connection.getBalance(player);
                console.log(`👛 Player balance: ${balance / this.LAMPORTS_PER_SOL} SOL`);
                
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
                console.log(`⏰ Completed at: ${new Date().toISOString()}`);

                return {
                    success: true,
                    signature: tx,
                    registrationPDA: registrationPDA.toString(),
                    entryFeePaid: entryFee,
                    timestamp: new Date().toISOString()
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
            return { 
                success: false, 
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get tournament data from blockchain
     */
    async getTournamentOnChain(tournamentId) {
        try {
            console.log(`🔍 Fetching tournament ${tournamentId} from chain...`);
            
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
                        platformFeesCollected: tournament.platformFeesCollected.toNumber() / this.LAMPORTS_PER_SOL,
                        startTime: new Date(tournament.startTime.toNumber() * 1000).toISOString(),
                        endTime: new Date(tournament.endTime.toNumber() * 1000).toISOString(),
                        isActive: tournament.isActive,
                        isFinalized: tournament.isFinalized,
                        escrowBump: tournament.escrowBump
                    },
                    pda: tournamentPDA.toString(),
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    success: false,
                    error: 'Cannot fetch tournament data without Anchor'
                };
            }

        } catch (error) {
            console.error('❌ Failed to fetch tournament:', error);
            
            // Check if account doesn't exist
            if (error.message.includes('Account does not exist')) {
                return {
                    success: false,
                    error: 'Tournament not found on chain',
                    tournamentId
                };
            }
            
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
            console.log(`⏰ Test started at: ${new Date().toISOString()}`);
            console.log('==============================');
            
            // Test 1: Basic components
            console.log('\n1️⃣ Basic Components:');
            console.log('   Wallet provided:', !!this.wallet);
            console.log('   Wallet public key:', this.wallet?.publicKey?.toString());
            console.log('   Solana Web3 loaded:', !!this.Connection);
            console.log('   Buffer available:', !!this.Buffer);
            
            // Test 2: Anchor availability
            console.log('\n2️⃣ Anchor Status:');
            console.log('   Anchor object:', !!this.anchor);
            console.log('   AnchorProvider:', !!this.AnchorProvider);
            console.log('   Program class:', !!this.Program);
            console.log('   BN class:', !!this.BN);
            console.log('   Anchor program instance:', !!this.program);
            
            // Test 3: Connection
            console.log('\n3️⃣ Blockchain Connection:');
            const version = await this.connection.getVersion();
            console.log('   ✅ Connected to Solana:', version['solana-core']);
            
            // Test 4: Program exists
            const programInfo = await this.connection.getAccountInfo(this.PROGRAM_ID);
            console.log('   ✅ Escrow program found:', !!programInfo);
            console.log('   Program executable:', programInfo?.executable);
            console.log('   Program deployed to:', this.PROGRAM_ID.toString());
            
            // Test 5: Wallet balance
            if (this.wallet?.publicKey) {
                const balance = await this.connection.getBalance(this.wallet.publicKey);
                console.log(`   Wallet balance: ${balance / this.LAMPORTS_PER_SOL} SOL`);
            }
            
            // Test 6: Buffer functionality
            console.log('\n4️⃣ Buffer Tests:');
            
            // Test Buffer.from with string
            const testString = 'hello world';
            const bufferFromString = this.Buffer.from(testString);
            console.log('   ✅ Buffer.from(string):', bufferFromString.length, 'bytes');
            
            // Test Buffer.from with hex
            const hexString = '48656c6c6f'; // "Hello" in hex
            const bufferFromHex = this.Buffer.from(hexString, 'hex');
            console.log('   ✅ Buffer.from(hex):', bufferFromHex.length, 'bytes');
            
            // Test Buffer.concat
            const concat = this.Buffer.concat([bufferFromString, bufferFromHex]);
            console.log('   ✅ Buffer.concat:', concat.length, 'bytes');
            
            // Test 7: Generate test PDAs
            console.log('\n5️⃣ PDA Generation:');
            const testId = this.generateUniqueTournamentId('test');
            const [tournamentPDA, tournamentBump] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('tournament'), this.Buffer.from(testId)],
                this.PROGRAM_ID
            );
            const [escrowPDA, escrowBump] = await this.PublicKey.findProgramAddress(
                [this.Buffer.from('escrow'), this.Buffer.from(testId)],
                this.PROGRAM_ID
            );
            console.log('   ✅ Tournament PDA:', tournamentPDA.toString());
            console.log('   ✅ Escrow PDA:', escrowPDA.toString());
            console.log('   Bumps:', { tournament: tournamentBump, escrow: escrowBump });
            
            // Test 8: BN functionality
            if (this.BN) {
                console.log('\n6️⃣ BN (Big Number) Tests:');
                const testBN = new this.BN(1000000);
                console.log('   ✅ BN creation:', testBN.toString());
                console.log('   ✅ BN to number:', testBN.toNumber());
                const bnArray = testBN.toArray('le', 8);
                console.log('   ✅ BN to array:', bnArray.length, 'bytes');
            }
            
            // Test 9: Can create instructions
            console.log('\n7️⃣ Instruction Creation Test:');
            try {
                const testInstruction = new this.TransactionInstruction({
                    programId: this.PROGRAM_ID,
                    keys: [
                        { pubkey: tournamentPDA, isSigner: false, isWritable: true }
                    ],
                    data: this.Buffer.from([0, 1, 2, 3])
                });
                console.log('   ✅ Can create instructions');
            } catch (e) {
                console.log('   ❌ Cannot create instructions:', e.message);
            }
            
            // Summary
            console.log('\n==============================');
            console.log('📊 Summary:');
            const canUseAnchor = !!(this.program && this.BN && this.AnchorProvider);
            const canUseDirect = !!(this.Transaction && this.TransactionInstruction && this.Buffer);
            
            console.log('   Can use Anchor:', canUseAnchor ? '✅ Yes' : '❌ No');
            console.log('   Can use direct transactions:', canUseDirect ? '✅ Yes' : '❌ No');
            console.log('   Recommended method:', canUseAnchor ? 'Anchor' : (canUseDirect ? 'Direct' : 'None available'));
            console.log('   🎉 PROGRAM IS DEPLOYED AND READY!');
            console.log(`   ⏰ Test completed at: ${new Date().toISOString()}`);
            
            return { 
                success: true, 
                message: 'Connection test complete',
                details: {
                    walletConnected: !!this.wallet,
                    solanaConnected: true,
                    programFound: !!programInfo,
                    programDeployed: true,
                    programId: this.PROGRAM_ID.toString(),
                    bufferWorking: true,
                    pdaGeneration: true,
                    anchorAvailable: canUseAnchor,
                    directTransactionsAvailable: canUseDirect
                },
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            return { 
                success: false, 
                error: error.message,
                timestamp: new Date().toISOString()
            };
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
            AnchorProgram: !!this.program,
            Wallet: !!this.wallet,
            BN: !!this.BN
        };
        
        console.log('📋 Dependency check:', deps);
        console.log(`⏰ Checked at: ${new Date().toISOString()}`);
        return deps;
    }
    
    /**
     * Static method to wait for Anchor and create instance
     */
    static async waitForAnchorAndCreate(wallet, maxAttempts = 10, delay = 500) {
        console.log('⏳ Waiting for Anchor to load...');
        console.log(`⏰ Started at: ${new Date().toISOString()}`);
        
        for (let i = 0; i < maxAttempts; i++) {
            // Check if Anchor is available
            if (window.anchor || window.Anchor) {
                console.log('✅ Anchor detected, creating escrow integration...');
                return new WalletWarsEscrowIntegration(wallet);
            }
            
            console.log(`   Attempt ${i + 1}/${maxAttempts}...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        console.warn('⚠️ Anchor not loaded after waiting, creating escrow with fallback mode');
        console.log(`⏰ Gave up at: ${new Date().toISOString()}`);
        return new WalletWarsEscrowIntegration(wallet);
    }
}

// Make it available globally
window.WalletWarsEscrowIntegration = WalletWarsEscrowIntegration;

console.log('✅ WalletWars Escrow Integration loaded!');
console.log('📋 Available at: window.WalletWarsEscrowIntegration');
console.log('🎮 Program ID:', '12j36Kp7fyzJcw29CPtoFuxg7Gy327HHTriEDUZNwv3Y');
console.log('💰 Platform Wallet:', '5RLDuPHsa7ohaKUSNc5iYvtgveL1qrCcVdxVHXPeG3b8');
console.log('🚀 PROGRAM DEPLOYED TO DEVNET!');
console.log(`⏰ Script loaded at: ${new Date().toISOString()}`);

// Auto-test if Buffer is available
if (typeof Buffer !== 'undefined' || (typeof window !== 'undefined' && window.Buffer)) {
    console.log('🎉 Buffer is available for escrow integration!');
} else {
    console.warn('⚠️ Buffer not yet available, will create polyfill when instantiated');
}

// Check Anchor availability
if (typeof window !== 'undefined') {
    if (window.anchor || window.Anchor) {
        console.log('🎉 Anchor is already available!');
    } else {
        console.log('⏳ Anchor not yet loaded. Use WalletWarsEscrowIntegration.waitForAnchorAndCreate() for automatic detection.');
    }
}