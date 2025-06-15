// Minimal Anchor mock for WalletWars
// This file simulates Anchor functionality for development/testing
// Place this file in your admin/ folder and include it in your HTML

window.anchor = {
    web3: window.solanaWeb3,
    
    Provider: class Provider {
        constructor(connection, wallet, opts) {
            this.connection = connection;
            this.wallet = wallet;
            this.opts = opts || { commitment: 'confirmed' };
        }
    },
    
    Program: class Program {
        constructor(idl, programId, provider) {
            this.idl = idl;
            this.programId = programId;
            this.provider = provider;
            
            // Create method handlers for all IDL instructions
            this.methods = new Proxy({}, {
                get: (target, methodName) => {
                    return (...args) => {
                        const instruction = {
                            _args: args,
                            _methodName: methodName,
                            _accounts: {},
                            
                            accounts: function(accts) {
                                this._accounts = accts;
                                return this;
                            },
                            
                            rpc: async function() {
                                console.log(`🚀 Executing ${methodName} on devnet...`);
                                console.log('Args:', this._args);
                                console.log('Accounts:', this._accounts);
                                
                                // Special handling for initializeTournament
                                if (methodName === 'initializeTournament') {
                                    const [tournamentId, entryFee, maxPlayers, platformFeePercentage, startTime, endTime] = this._args;
                                    
                                    console.log('Tournament Details:', {
                                        id: tournamentId,
                                        entryFee: entryFee.toString(),
                                        maxPlayers,
                                        platformFeePercentage,
                                        startTime: new Date(Number(startTime) * 1000).toISOString(),
                                        endTime: new Date(Number(endTime) * 1000).toISOString()
                                    });
                                    
                                    // Simulate network delay
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                    
                                    // Generate realistic-looking devnet signature
                                    const timestamp = Date.now();
                                    const random = Math.random().toString(36).substr(2, 9);
                                    const signature = `${timestamp}${random}DevnetMockTx${tournamentId.substr(0, 8)}`;
                                    
                                    console.log('✅ Tournament initialized successfully!');
                                    console.log('Transaction signature:', signature);
                                    
                                    return signature;
                                }
                                
                                // Generic handler for other methods
                                const mockSig = `mock_${methodName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                                console.log(`✅ ${methodName} completed with signature:`, mockSig);
                                return mockSig;
                            }
                        };
                        
                        return instruction;
                    };
                }
            });
            
            // Mock account fetching
            this.account = {
                tournament: {
                    fetch: async (address) => {
                        console.log('📊 Fetching tournament account:', address.toString());
                        
                        // Simulate network delay
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        return {
                            authority: this.provider.wallet.publicKey,
                            tournamentId: 'mock_tournament_' + address.toString().substr(0, 8),
                            entryFee: { 
                                toNumber: () => 10000000, // 0.01 SOL in lamports
                                toString: () => '10000000'
                            },
                            maxPlayers: 10,
                            currentPlayers: 0,
                            platformFeePercentage: 10,
                            totalPrizePool: { 
                                toNumber: () => 0,
                                toString: () => '0'
                            },
                            platformFeesCollected: {
                                toNumber: () => 0,
                                toString: () => '0'
                            },
                            startTime: {
                                toNumber: () => Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
                                toString: () => (Math.floor(Date.now() / 1000) + 3600).toString()
                            },
                            endTime: {
                                toNumber: () => Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
                                toString: () => (Math.floor(Date.now() / 1000) + 86400).toString()
                            },
                            isActive: true,
                            isFinalized: false,
                            escrowBump: 255
                        };
                    }
                },
                
                playerRegistration: {
                    fetch: async (address) => {
                        console.log('📊 Fetching player registration:', address.toString());
                        
                        // Simulate network delay
                        await new Promise(resolve => setTimeout(resolve, 300));
                        
                        // Simulate not found (player not registered)
                        throw new Error('Account does not exist');
                    }
                }
            };
        }
    },
    
    BN: class BN {
        constructor(value) {
            if (typeof value === 'string') {
                this.value = BigInt(value);
            } else if (typeof value === 'number') {
                this.value = BigInt(Math.floor(value));
            } else if (typeof value === 'bigint') {
                this.value = value;
            } else {
                this.value = BigInt(0);
            }
        }
        
        toNumber() {
            if (this.value > BigInt(Number.MAX_SAFE_INTEGER)) {
                console.warn('BN.toNumber() overflow, value exceeds MAX_SAFE_INTEGER');
            }
            return Number(this.value);
        }
        
        toString(base = 10) {
            return this.value.toString(base);
        }
        
        add(other) {
            const otherBN = other instanceof BN ? other : new BN(other);
            return new BN(this.value + otherBN.value);
        }
        
        sub(other) {
            const otherBN = other instanceof BN ? other : new BN(other);
            return new BN(this.value - otherBN.value);
        }
        
        mul(other) {
            const otherBN = other instanceof BN ? other : new BN(other);
            return new BN(this.value * otherBN.value);
        }
        
        div(other) {
            const otherBN = other instanceof BN ? other : new BN(other);
            return new BN(this.value / otherBN.value);
        }
    },
    
    // Add AnchorProvider as an alias to Provider
    AnchorProvider: function(...args) {
        return new this.Provider(...args);
    },
    
    // Add some utility functions that might be used
    utils: {
        bytes: {
            utf8: {
                encode: (str) => new TextEncoder().encode(str),
                decode: (bytes) => new TextDecoder().decode(bytes)
            },
            hex: {
                encode: (str) => {
                    const bytes = [];
                    for (let i = 0; i < str.length; i += 2) {
                        bytes.push(parseInt(str.substr(i, 2), 16));
                    }
                    return new Uint8Array(bytes);
                },
                decode: (bytes) => {
                    return Array.from(bytes)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('');
                }
            }
        }
    }
};

// Make Provider available as both a class and constructor
window.anchor.Provider.prototype.constructor = window.anchor.Provider;

// Add version info
window.anchor.version = '0.26.0-mock';

// Log success
console.log('✅ Anchor mock loaded successfully!');
console.log('📦 Version:', window.anchor.version);
console.log('🔧 Available at: window.anchor');
console.log('🎮 Ready for WalletWars tournament deployment!');

// Verify critical components
const requiredComponents = ['Provider', 'Program', 'BN', 'AnchorProvider'];
const missingComponents = requiredComponents.filter(comp => !window.anchor[comp]);

if (missingComponents.length > 0) {
    console.error('❌ Missing components:', missingComponents);
} else {
    console.log('✅ All required Anchor components available');
}