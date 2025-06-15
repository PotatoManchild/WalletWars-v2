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
                this.value = BigInt(number);
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
        
        toArray(endian = 'be', length) {
            const hex = this.value.toString(16);
            const padded = hex.padStart((length || Math.ceil(hex.length / 2)) * 2, '0');
            const bytes = [];
            
            for (let i = 0; i < padded.length; i += 2) {
                bytes.push(parseInt(padded.substr(i, 2), 16));
            }
            
            if (endian === 'le') {
                bytes.reverse();
            }
            
            return bytes;
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
     * Handles encoding/decoding of instruction data
     */
    class InstructionCoder {
        constructor(idl) {
            this.idl = idl;
            this.ixLayouts = {};
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
        }
        
        encode(ixName, args = {}) {
            const layout = this.ixLayouts[ixName];
            if (!layout) {
                throw new Error(`Unknown instruction: ${ixName}`);
            }
            
            // Simple encoding: instruction index + serialized args
            const data = [layout.index];
            
            // Encode args (simplified - real implementation would use borsh)
            const encoded = JSON.stringify(args);
            const bytes = new TextEncoder().encode(encoded);
            data.push(...bytes);
            
            return Buffer.from(data);
        }
        
        decode(data) {
            if (!data || data.length === 0) {
                throw new Error('Invalid instruction data');
            }
            
            const index = data[0];
            const ixName = Object.values(this.ixLayouts).find(l => l.index === index)?.name;
            
            if (!ixName) {
                throw new Error(`Unknown instruction index: ${index}`);
            }
            
            // Decode args (simplified)
            try {
                const argData = data.slice(1);
                const decoded = new TextDecoder().decode(argData);
                const args = JSON.parse(decoded);
                return { name: ixName, data: args };
            } catch {
                return { name: ixName, data: {} };
            }
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
            this._args = args;
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
            
            // Encode instruction data
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
    console.log('Version: Browser-compatible (WalletWars edition)');
    console.log('Available at: window.anchor');
    
})(typeof window !== 'undefined' ? window : global);