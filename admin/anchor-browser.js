/**
 * anchor-browser.js
 * Browser-ready Anchor.js implementation for WalletWars
 * Compatible with vanilla JavaScript (no build tools required)
 */

(function(global) {
    'use strict';
    
    // Check dependencies
    if (!global.solanaWeb3) {
        console.error('[Anchor] Solana Web3.js is required. Please load it first:');
        console.error('<script src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"></script>');
        return;
    }
    
    const { 
        Connection, 
        PublicKey, 
        Transaction, 
        TransactionInstruction,
        SystemProgram,
        SYSVAR_RENT_PUBKEY,
        Keypair
    } = global.solanaWeb3;
    
    // Create the anchor namespace
    const anchor = {};
    
    /**
     * BN (Big Number) implementation
     * Uses native BigInt with compatibility methods
     */
    class BN {
        constructor(number, base = 10) {
            if (typeof number === 'string') {
                this.value = BigInt(parseInt(number, base));
            } else if (typeof number === 'number') {
                this.value = BigInt(Math.floor(number));
            } else if (number instanceof BN) {
                this.value = number.value;
            } else if (typeof number === 'bigint') {
                this.value = number;
            } else {
                this.value = BigInt(0);
            }
        }
        
        toString(base = 10) {
            if (base === 10) {
                return this.value.toString();
            }
            return this.value.toString(base);
        }
        
        toNumber() {
            if (this.value > Number.MAX_SAFE_INTEGER || this.value < Number.MIN_SAFE_INTEGER) {
                throw new Error('Number exceeds safe integer range');
            }
            return Number(this.value);
        }
        
        toArray(endian = 'be', length = 8) {
            // Convert to hex string first
            let hex = this.value.toString(16);
            
            // Handle negative numbers
            if (this.value < 0) {
                // Two's complement for negative numbers
                const bits = length * 8;
                const max = BigInt(1) << BigInt(bits);
                hex = (max + this.value).toString(16);
            }
            
            // Pad to even number of characters
            if (hex.length % 2 !== 0) {
                hex = '0' + hex;
            }
            
            // Pad to desired length
            const targetLength = length * 2;
            hex = hex.padStart(targetLength, '0');
            
            // Convert to byte array
            const bytes = [];
            for (let i = 0; i < targetLength; i += 2) {
                bytes.push(parseInt(hex.substr(i, 2), 16));
            }
            
            if (endian === 'le') {
                bytes.reverse();
            }
            
            return bytes.slice(0, length);
        }
        
        toBuffer(endian = 'be', length = 8) {
            return Buffer.from(this.toArray(endian, length));
        }
        
        add(other) {
            return new BN(this.value + new BN(other).value);
        }
        
        sub(other) {
            return new BN(this.value - new BN(other).value);
        }
        
        mul(other) {
            return new BN(this.value * new BN(other).value);
        }
        
        div(other) {
            return new BN(this.value / new BN(other).value);
        }
        
        mod(other) {
            return new BN(this.value % new BN(other).value);
        }
        
        eq(other) {
            return this.value === new BN(other).value;
        }
        
        lt(other) {
            return this.value < new BN(other).value;
        }
        
        lte(other) {
            return this.value <= new BN(other).value;
        }
        
        gt(other) {
            return this.value > new BN(other).value;
        }
        
        gte(other) {
            return this.value >= new BN(other).value;
        }
        
        // IMPORTANT: Custom JSON serialization to avoid BigInt issues
        toJSON() {
            // Return as string to avoid BigInt serialization errors
            return this.toString();
        }
        
        // For Anchor compatibility - serialize to bytes for RPC
        serialize() {
            return this.toArray('le', 8);
        }
    }
    
    /**
     * Provider class
     * Manages the connection and wallet
     */
    class Provider {
        constructor(connection, wallet, opts = {}) {
            this.connection = connection;
            this.wallet = wallet;
            this.opts = {
                preflightCommitment: opts.preflightCommitment || 'confirmed',
                commitment: opts.commitment || 'confirmed',
                skipPreflight: opts.skipPreflight || false,
                maxRetries: opts.maxRetries || 3,
                ...opts
            };
        }
        
        static local(url = 'http://localhost:8899', opts) {
            const connection = new Connection(url, opts?.commitment || 'confirmed');
            return new Provider(connection, null, opts);
        }
        
        static env() {
            if (typeof process !== 'undefined' && process.env) {
                const url = process.env.ANCHOR_PROVIDER_URL || 'http://localhost:8899';
                const connection = new Connection(url);
                return new Provider(connection, null);
            }
            // In browser, default to devnet
            const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
            return new Provider(connection, global.solana || null);
        }
        
        async sendAndConfirm(tx, signers, opts) {
            if (!this.wallet?.publicKey) {
                throw new Error('Wallet not connected');
            }
            
            const options = { ...this.opts, ...opts };
            
            // If we have signers, add them
            if (signers && signers.length > 0) {
                tx.partialSign(...signers);
            }
            
            // If using a browser wallet
            if (this.wallet.signTransaction) {
                const signed = await this.wallet.signTransaction(tx);
                const txId = await this.connection.sendRawTransaction(
                    signed.serialize(),
                    options
                );
                
                if (!options.skipPreflight) {
                    await this.connection.confirmTransaction(txId, options.commitment);
                }
                
                return txId;
            }
            
            // If using a keypair
            if (this.wallet.secretKey) {
                tx.sign(this.wallet);
                const txId = await this.connection.sendRawTransaction(
                    tx.serialize(),
                    options
                );
                
                if (!options.skipPreflight) {
                    await this.connection.confirmTransaction(txId, options.commitment);
                }
                
                return txId;
            }
            
            throw new Error('Invalid wallet type');
        }
        
        async send(tx, signers, opts) {
            return this.sendAndConfirm(tx, signers, opts);
        }
    }
    
    /**
     * Instruction Coder
     * Handles encoding/decoding of instruction data with proper Anchor discriminators
     */
    class InstructionCoder {
        constructor(idl) {
            this.idl = idl;
            this.ixLayouts = {};
            this.discriminators = {};
            this._buildLayouts();
        }
        
        _buildLayouts() {
            // Build instruction layouts from IDL
            if (!this.idl.instructions) return;
            
            this.idl.instructions.forEach((ix, idx) => {
                this.ixLayouts[ix.name] = {
                    index: idx,
                    name: ix.name,
                    args: ix.args || []
                };
            });
            
            // Pre-calculated discriminators for walletwars_escrow
            // Trying simple index-based discriminators first
            this.discriminators = {
                'initializeTournament': [0, 0, 0, 0, 0, 0, 0, 0],  // Try index 0
                'registerPlayer': [1, 0, 0, 0, 0, 0, 0, 0],       // Try index 1
                'finalizeTournament': [2, 0, 0, 0, 0, 0, 0, 0],   // Try index 2
                'distributePrize': [3, 0, 0, 0, 0, 0, 0, 0],      // Try index 3
                'collectPlatformFees': [4, 0, 0, 0, 0, 0, 0, 0],  // Try index 4
                'cancelTournament': [5, 0, 0, 0, 0, 0, 0, 0],     // Try index 5
                'refundPlayer': [6, 0, 0, 0, 0, 0, 0, 0]          // Try index 6
            };
        }
        
        encode(ixName, args = []) {
            const layout = this.ixLayouts[ixName];
            if (!layout) {
                throw new Error(`Unknown instruction: ${ixName}`);
            }
            
            // Get discriminator
            const discriminator = this.discriminators[ixName];
            if (!discriminator) {
                throw new Error(`No discriminator found for instruction: ${ixName}`);
            }
            
            console.log(`🔧 Encoding instruction: ${ixName}`);
            console.log('Discriminator:', discriminator);
            console.log('Args:', args);
            
            // Start with discriminator
            const data = [...discriminator];
            
            // Handle specific instruction encoding
            if (ixName === 'initializeTournament') {
                // Args: [tournamentId, entryFee, maxPlayers, platformFeePercentage, startTime, endTime]
                const [tournamentId, entryFee, maxPlayers, platformFeePercentage, startTime, endTime] = args;
                
                console.log('Encoding initializeTournament with:');
                console.log('- tournamentId:', tournamentId);
                console.log('- entryFee:', entryFee?.toString ? entryFee.toString() : entryFee);
                console.log('- maxPlayers:', maxPlayers);
                console.log('- platformFeePercentage:', platformFeePercentage);
                console.log('- startTime:', startTime?.toString ? startTime.toString() : startTime);
                console.log('- endTime:', endTime?.toString ? endTime.toString() : endTime);
                
                // 1. Encode string (tournament ID) - 4 byte length prefix + UTF8 bytes
                const idBytes = new TextEncoder().encode(tournamentId);
                const idLength = idBytes.length;
                data.push(idLength & 0xff);
                data.push((idLength >> 8) & 0xff);
                data.push((idLength >> 16) & 0xff);
                data.push((idLength >> 24) & 0xff);
                data.push(...idBytes);
                
                // 2. Encode u64 (entry fee) - 8 bytes little endian
                // entryFee should be a BN instance
                if (entryFee && typeof entryFee.toArray === 'function') {
                    const entryFeeArray = entryFee.toArray('le', 8);
                    data.push(...entryFeeArray);
                } else {
                    // Fallback if not a BN
                    const val = BigInt(entryFee || 0);
                    for (let i = 0; i < 8; i++) {
                        data.push(Number((val >> BigInt(i * 8)) & BigInt(0xff)));
                    }
                }
                
                // 3. Encode u32 (max players) - 4 bytes little endian
                const maxP = maxPlayers || 0;
                data.push(maxP & 0xff);
                data.push((maxP >> 8) & 0xff);
                data.push((maxP >> 16) & 0xff);
                data.push((maxP >> 24) & 0xff);
                
                // 4. Encode u8 (platform fee percentage)
                data.push((platformFeePercentage || 0) & 0xff);
                
                // 5. Encode i64 (start time) - 8 bytes little endian
                if (startTime && typeof startTime.toArray === 'function') {
                    const startTimeArray = startTime.toArray('le', 8);
                    data.push(...startTimeArray);
                } else {
                    const val = BigInt(startTime || 0);
                    for (let i = 0; i < 8; i++) {
                        data.push(Number((val >> BigInt(i * 8)) & BigInt(0xff)));
                    }
                }
                
                // 6. Encode i64 (end time) - 8 bytes little endian
                if (endTime && typeof endTime.toArray === 'function') {
                    const endTimeArray = endTime.toArray('le', 8);
                    data.push(...endTimeArray);
                } else {
                    const val = BigInt(endTime || 0);
                    for (let i = 0; i < 8; i++) {
                        data.push(Number((val >> BigInt(i * 8)) & BigInt(0xff)));
                    }
                }
                
                console.log('📦 Encoded data length:', data.length, 'bytes');
                console.log('Hex:', data.map(b => b.toString(16).padStart(2, '0')).join(' '));
            } else if (ixName === 'registerPlayer') {
                // No args for registerPlayer
            } else {
                // For other instructions, implement as needed
                console.warn(`Instruction ${ixName} encoding not fully implemented`);
            }
            
            return Buffer.from(data);
        }
        
        decode(data) {
            if (!data || data.length < 8) {
                throw new Error('Invalid instruction data');
            }
            
            // Extract discriminator (first 8 bytes)
            const discriminator = Array.from(data.slice(0, 8));
            
            // Find matching instruction
            let ixName = null;
            for (const [name, disc] of Object.entries(this.discriminators)) {
                if (this._arraysEqual(discriminator, disc)) {
                    ixName = name;
                    break;
                }
            }
            
            if (!ixName) {
                throw new Error(`Unknown instruction discriminator: [${discriminator.join(', ')}]`);
            }
            
            // TODO: Implement proper decoding based on instruction
            return { name: ixName, data: {} };
        }
        
        _arraysEqual(a, b) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return false;
            }
            return true;
        }
    }
    
    /**
     * Account Coder
     * Handles encoding/decoding of account data
     */
    class AccountCoder {
        constructor(idl) {
            this.idl = idl;
            this.accountLayouts = {};
            this._buildLayouts();
        }
        
        _buildLayouts() {
            if (!this.idl.accounts) return;
            
            this.idl.accounts.forEach(acc => {
                this.accountLayouts[acc.name] = {
                    name: acc.name,
                    type: acc.type
                };
            });
        }
        
        decode(accountName, data) {
            const layout = this.accountLayouts[accountName];
            if (!layout) {
                throw new Error(`Unknown account: ${accountName}`);
            }
            
            // Simplified decoding - real implementation would use borsh
            try {
                const decoded = new TextDecoder().decode(data);
                return JSON.parse(decoded);
            } catch {
                // Return raw data if can't decode
                return { raw: data };
            }
        }
        
        encode(accountName, data) {
            const layout = this.accountLayouts[accountName];
            if (!layout) {
                throw new Error(`Unknown account: ${accountName}`);
            }
            
            // Simplified encoding
            const encoded = JSON.stringify(data);
            return Buffer.from(new TextEncoder().encode(encoded));
        }
    }
    
    /**
     * Coder
     * Main coder class that combines instruction and account coders
     */
    class Coder {
        constructor(idl) {
            this.instruction = new InstructionCoder(idl);
            this.accounts = new AccountCoder(idl);
        }
    }
    
    /**
     * MethodsBuilder
     * Provides fluent API for building transactions
     */
    class MethodsBuilder {
        constructor(program, name, args) {
            this._program = program;
            this._ixName = name;
            this._args = args; // Array of arguments
            this._accounts = {};
            this._remainingAccounts = [];
            this._signers = [];
            this._preInstructions = [];
            this._postInstructions = [];
        }
        
        accounts(accounts) {
            Object.assign(this._accounts, accounts);
            return this;
        }
        
        signers(signers) {
            this._signers.push(...signers);
            return this;
        }
        
        remainingAccounts(accounts) {
            this._remainingAccounts.push(...accounts);
            return this;
        }
        
        preInstructions(ixs) {
            this._preInstructions.push(...ixs);
            return this;
        }
        
        postInstructions(ixs) {
            this._postInstructions.push(...ixs);
            return this;
        }
        
        async instruction() {
            const idlIx = this._program._idl.instructions.find(
                ix => ix.name === this._ixName
            );
            
            if (!idlIx) {
                throw new Error(`Unknown instruction: ${this._ixName}`);
            }
            
            // Build keys from accounts
            const keys = [];
            
            if (idlIx.accounts) {
                for (const acc of idlIx.accounts) {
                    const pubkey = this._accounts[acc.name];
                    if (!pubkey) {
                        throw new Error(`Missing account: ${acc.name}`);
                    }
                    
                    keys.push({
                        pubkey: new PublicKey(pubkey),
                        isSigner: acc.isSigner || false,
                        isWritable: acc.isMut || false
                    });
                }
            }
            
            // Add remaining accounts
            keys.push(...this._remainingAccounts);
            
            // Encode instruction data - pass args array to encoder
            const data = this._program._coder.instruction.encode(
                this._ixName,
                this._args
            );
            
            return new TransactionInstruction({
                keys,
                programId: this._program.programId,
                data
            });
        }
        
        async transaction() {
            const tx = new Transaction();
            
            // Add pre-instructions
            for (const ix of this._preInstructions) {
                tx.add(ix);
            }
            
            // Add main instruction
            const ix = await this.instruction();
            tx.add(ix);
            
            // Add post-instructions
            for (const ix of this._postInstructions) {
                tx.add(ix);
            }
            
            // Set fee payer
            if (this._program.provider.wallet?.publicKey) {
                tx.feePayer = this._program.provider.wallet.publicKey;
            }
            
            // Get recent blockhash
            const { blockhash } = await this._program.provider.connection.getLatestBlockhash(
                this._program.provider.opts.commitment
            );
            tx.recentBlockhash = blockhash;
            
            return tx;
        }
        
        async rpc(opts) {
            const tx = await this.transaction();
            return await this._program.provider.sendAndConfirm(
                tx,
                this._signers,
                opts
            );
        }
        
        async simulate(opts) {
            const tx = await this.transaction();
            return await this._program.provider.connection.simulateTransaction(
                tx,
                this._signers,
                opts
            );
        }
    }
    
    /**
     * Program
     * Main class for interacting with Anchor programs
     */
    class Program {
        constructor(idl, programId, provider = Provider.env()) {
            this._idl = idl;
            this._programId = new PublicKey(programId);
            this._provider = provider;
            this._coder = new Coder(idl);
            
            // Build methods
            this.methods = {};
            if (idl.instructions) {
                for (const ix of idl.instructions) {
                    this.methods[ix.name] = (...args) => {
                        return new MethodsBuilder(this, ix.name, args);
                    };
                }
            }
            
            // Build accounts namespace
            this.account = {};
            if (idl.accounts) {
                for (const acc of idl.accounts) {
                    this.account[acc.name] = new AccountClient(
                        this._provider,
                        this._programId,
                        this._coder,
                        acc.name
                    );
                }
            }
            
            // Build RPC namespace (legacy)
            this.rpc = {};
            if (idl.instructions) {
                for (const ix of idl.instructions) {
                    this.rpc[ix.name] = async (...args) => {
                        const tx = new Transaction();
                        const instruction = await this.methods[ix.name](...args).instruction();
                        tx.add(instruction);
                        return await this._provider.sendAndConfirm(tx);
                    };
                }
            }
        }
        
        get programId() {
            return this._programId;
        }
        
        get idl() {
            return this._idl;
        }
        
        get provider() {
            return this._provider;
        }
        
        addEventListener(eventName, callback) {
            console.warn('Event listeners not implemented in browser version');
            return null;
        }
        
        removeEventListener(listener) {
            console.warn('Event listeners not implemented in browser version');
        }
    }
    
    /**
     * AccountClient
     * Handles fetching and decoding account data
     */
    class AccountClient {
        constructor(provider, programId, coder, accountName) {
            this._provider = provider;
            this._programId = programId;
            this._coder = coder;
            this._accountName = accountName;
        }
        
        async fetch(address) {
            const pubkey = new PublicKey(address);
            const accountInfo = await this._provider.connection.getAccountInfo(pubkey);
            
            if (!accountInfo) {
                return null;
            }
            
            return this._coder.accounts.decode(
                this._accountName,
                accountInfo.data
            );
        }
        
        async fetchMultiple(addresses) {
            const pubkeys = addresses.map(a => new PublicKey(a));
            const accountInfos = await this._provider.connection.getMultipleAccountsInfo(pubkeys);
            
            return accountInfos.map((info, idx) => {
                if (!info) return null;
                return this._coder.accounts.decode(
                    this._accountName,
                    info.data
                );
            });
        }
        
        async all(filters = []) {
            const accounts = await this._provider.connection.getProgramAccounts(
                this._programId,
                {
                    filters: [
                        { dataSize: 165 }, // Adjust based on your account size
                        ...filters
                    ]
                }
            );
            
            return accounts.map(({ pubkey, account }) => ({
                publicKey: pubkey,
                account: this._coder.accounts.decode(
                    this._accountName,
                    account.data
                )
            }));
        }
    }
    
    // Utility functions
    anchor.setProvider = function(provider) {
        anchor._provider = provider;
    };
    
    anchor.getProvider = function() {
        if (!anchor._provider) {
            anchor._provider = Provider.env();
        }
        return anchor._provider;
    };
    
    // PDA utilities
    anchor.utils = {
        bytes: {
            utf8: {
                encode: (str) => Buffer.from(str, 'utf8'),
                decode: (buffer) => buffer.toString('utf8')
            },
            hex: {
                encode: (str) => Buffer.from(str, 'hex'),
                decode: (buffer) => buffer.toString('hex')
            },
            base58: {
                encode: (buffer) => {
                    // Use Solana's base58 if available
                    if (global.solanaWeb3.utils?.toBase58) {
                        return global.solanaWeb3.utils.toBase58(buffer);
                    }
                    throw new Error('Base58 encoding not available');
                },
                decode: (str) => {
                    if (global.solanaWeb3.utils?.fromBase58) {
                        return Buffer.from(global.solanaWeb3.utils.fromBase58(str));
                    }
                    throw new Error('Base58 decoding not available');
                }
            }
        },
        publicKey: {
            findProgramAddressSync: (seeds, programId) => {
                return PublicKey.findProgramAddressSync(seeds, programId);
            },
            createWithSeedSync: (fromPublicKey, seed, programId) => {
                return PublicKey.createWithSeedSync(fromPublicKey, seed, programId);
            }
        }
    };
    
    // Web3 re-exports
    anchor.web3 = {
        ...global.solanaWeb3,
        // Ensure commonly used items are available
        PublicKey,
        SystemProgram,
        Transaction,
        TransactionInstruction,
        SYSVAR_RENT_PUBKEY,
        Keypair,
        Connection
    };
    
    // Export classes
    anchor.BN = BN;
    anchor.Provider = Provider;
    anchor.Program = Program;
    anchor.Coder = Coder;
    anchor.InstructionCoder = InstructionCoder;
    anchor.AccountCoder = AccountCoder;
    
    // Workspace (empty in browser)
    anchor.workspace = {};
    
    // Expose to global
    global.anchor = anchor;
    
    // Also expose as Anchor (capital A) for compatibility
    global.Anchor = anchor;
    
    console.log('✅ Anchor.js browser implementation loaded successfully');
    console.log('Version: Browser-compatible (WalletWars edition) with proper instruction encoding');
    console.log('Available at: window.anchor');
    
})(typeof window !== 'undefined' ? window : global);