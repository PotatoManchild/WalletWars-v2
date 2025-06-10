// admin-auth-supabase.js
// Secure admin authentication using Supabase RPC functions
// No Edge Functions needed - uses PostgreSQL functions directly!

class SupabaseAdminAuth {
    constructor() {
        this.sessionKey = 'walletwars_admin_session';
        this.authorized = false;
        this.adminToken = null;
        
        // Your authorized admin wallets
        this.authorizedWallets = [
            '6PoB9i9kpumDze7EhiL3CicAuEPxDAzrTVzHYot9sx9h'
        ];
        
        // Get Supabase client - with fallback
        if (window.walletWarsAPI && window.walletWarsAPI.supabase) {
            this.supabase = window.walletWarsAPI.supabase;
        } else {
            // Create our own client if walletWarsAPI isn't ready yet
            this.supabase = window.supabase.createClient(
                window.SUPABASE_URL || 'https://miwtcvcdpoqtqjbbvnxz.supabase.co',
                window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pd3RjdmNkcG9xdHFqYmJ2bnh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3Mjk4MTAsImV4cCI6MjA2NDMwNTgxMH0.5FCUjucAu2PxGEVc3X01dwa4wt4tHLewsjBO7s55Zt8'
            );
        }
        
        this.init();
    }
    
    async init() {
        // Check existing session
        const session = this.getStoredSession();
        if (session && session.token) {
            // Verify token is still valid
            const isValid = await this.verifyToken(session.token);
            if (isValid) {
                this.authorized = true;
                this.adminToken = session.token;
                console.log('✅ Valid admin session restored');
            } else {
                this.clearSession();
            }
        }
    }
    
    /**
     * Show PIN entry modal
     */
    async showPinModal(walletAddress) {
        return new Promise((resolve, reject) => {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 100000;
                backdrop-filter: blur(10px);
            `;
            
            modal.innerHTML = `
                <div style="
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border: 2px solid #8b5cf6;
                    border-radius: 1rem;
                    padding: 3rem;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3);
                ">
                    <h2 style="color: #8b5cf6; margin-bottom: 1rem; font-size: 1.5rem;">
                        🔐 Admin Authentication
                    </h2>
                    
                    <p style="color: #d1d5db; margin-bottom: 2rem;">
                        Wallet: ${walletAddress.substring(0, 8)}...${walletAddress.slice(-6)}
                    </p>
                    
                    <div style="margin-bottom: 2rem;">
                        <label style="display: block; color: #9ca3af; margin-bottom: 0.5rem; text-align: left;">
                            Enter your 4-digit PIN:
                        </label>
                        <input type="password" id="adminPin" maxlength="4" pattern="[0-9]{4}" 
                               placeholder="••••" autocomplete="off"
                               style="
                                   width: 100%;
                                   padding: 1rem;
                                   font-size: 1.5rem;
                                   text-align: center;
                                   letter-spacing: 0.5rem;
                                   background: rgba(15, 23, 42, 0.8);
                                   border: 1px solid rgba(139, 92, 246, 0.3);
                                   border-radius: 0.5rem;
                                   color: #ffffff;
                                   outline: none;
                               ">
                        
                        <div id="pinError" style="
                            color: #ef4444;
                            margin-top: 0.5rem;
                            font-size: 0.9rem;
                            display: none;
                        "></div>
                    </div>
                    
                    <div style="display: flex; gap: 1rem;">
                        <button id="cancelPin" style="
                            flex: 1;
                            background: rgba(107, 114, 128, 0.3);
                            border: 1px solid rgba(107, 114, 128, 0.5);
                            color: #d1d5db;
                            padding: 0.75rem;
                            border-radius: 0.5rem;
                            font-weight: 600;
                            cursor: pointer;
                        ">Cancel</button>
                        
                        <button id="submitPin" style="
                            flex: 1;
                            background: linear-gradient(135deg, #8b5cf6, #ec4899);
                            border: none;
                            color: white;
                            padding: 0.75rem;
                            border-radius: 0.5rem;
                            font-weight: 600;
                            cursor: pointer;
                        ">Authenticate</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const pinInput = document.getElementById('adminPin');
            const submitBtn = document.getElementById('submitPin');
            const cancelBtn = document.getElementById('cancelPin');
            const errorDiv = document.getElementById('pinError');
            
            pinInput.focus();
            
            // Only allow numbers
            pinInput.addEventListener('keypress', (e) => {
                if (!/[0-9]/.test(e.key) && e.key !== 'Enter') {
                    e.preventDefault();
                }
            });
            
            const handleSubmit = async () => {
                const pin = pinInput.value;
                
                if (pin.length !== 4) {
                    errorDiv.textContent = 'PIN must be 4 digits';
                    errorDiv.style.display = 'block';
                    return;
                }
                
                submitBtn.disabled = true;
                submitBtn.textContent = 'Authenticating...';
                
                try {
                    const result = await this.authenticateWithPin(walletAddress, pin);
                    
                    if (result.success) {
                        modal.remove();
                        resolve(true);
                    } else {
                        errorDiv.textContent = result.error || 'Authentication failed';
                        errorDiv.style.display = 'block';
                        pinInput.value = '';
                        pinInput.focus();
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Authenticate';
                    }
                } catch (error) {
                    errorDiv.textContent = 'Connection error. Please try again.';
                    errorDiv.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Authenticate';
                }
            };
            
            submitBtn.addEventListener('click', handleSubmit);
            pinInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && pinInput.value.length === 4) {
                    handleSubmit();
                }
            });
            
            cancelBtn.addEventListener('click', () => {
                modal.remove();
                reject(new Error('Authentication cancelled'));
            });
        });
    }
    
    /**
     * Authenticate with Supabase RPC
     */
    async authenticateWithPin(walletAddress, pin) {
        try {
            // Get wallet signature
            const provider = window.phantom?.solana || window.solana;
            if (!provider) {
                throw new Error('No wallet provider');
            }
            
            const message = `WalletWars Admin Login\n${Date.now()}`;
            const encodedMessage = new TextEncoder().encode(message);
            const signature = await provider.signMessage(encodedMessage);
            const signatureBase58 = bs58.encode(signature);
            
            // Call Supabase RPC function
            const { data, error } = await this.supabase
                .rpc('authenticate_admin', {
                    p_wallet_address: walletAddress,
                    p_pin: pin,
                    p_signature: signatureBase58
                });
            
            if (error) {
                console.error('Auth error:', error);
                return { success: false, error: error.message };
            }
            
            // Check if data exists and has the expected structure
            if (data && data.success === true) {
                // Store session
                this.adminToken = data.token;
                this.authorized = true;
                this.storeSession({
                    token: data.token,
                    expires_at: data.expires_at,
                    wallet: walletAddress
                });
                
                console.log('✅ Admin authenticated successfully');
                return { success: true };
            }
            // If no success, return the error
            return { success: false, error: (data && data.error) || 'Authentication failed' };
            
        } catch (error) {
            console.error('Authentication error:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Verify token with Supabase
     */
    async verifyToken(token) {
        try {
            const { data, error } = await this.supabase
                .rpc('verify_admin_token', {
                    p_token: token
                });
            
            return !error && data !== null;
        } catch (error) {
            console.error('Token verification error:', error);
            return false;
        }
    }
    
    /**
     * Connect admin wallet
     */
    async connectAdminWallet() {
        try {
            const provider = window.phantom?.solana || window.solana;
            
            if (!provider) {
                alert('Please install Phantom wallet');
                return;
            }
            
            const response = await provider.connect();
            const walletAddress = response.publicKey.toString();
            
            // Check if wallet is in authorized list
            if (!this.authorizedWallets.includes(walletAddress)) {
                alert('❌ This wallet is not authorized for admin access');
                return;
            }
            
            // Show PIN modal
            try {
                await this.showPinModal(walletAddress);
                
                // Success - reload page
                location.reload();
                
            } catch (error) {
                console.log('Authentication cancelled');
            }
            
        } catch (error) {
            console.error('Wallet connection error:', error);
            alert('Failed to connect wallet');
        }
    }
    
    /**
     * Make authenticated API call
     */
    async authenticatedRPC(functionName, params = {}) {
        if (!this.adminToken) {
            throw new Error('Not authenticated');
        }
        
        // Add token to params
        const authenticatedParams = {
            p_token: this.adminToken,
            ...params
        };
        
        const { data, error } = await this.supabase
            .rpc(functionName, authenticatedParams);
        
        if (error) {
            // Check if unauthorized
            if (error.message.includes('Unauthorized')) {
                this.handleUnauthorized();
            }
            throw error;
        }
        
        return data;
    }
    
    /**
     * Update tournament configuration
     */
    async updateConfig(config) {
        return await this.authenticatedRPC('update_tournament_config', {
            p_config: config
        });
    }
    
    /**
     * Store session
     */
    storeSession(session) {
        sessionStorage.setItem(this.sessionKey, JSON.stringify(session));
    }
    
    /**
     * Get stored session
     */
    getStoredSession() {
        try {
            const data = sessionStorage.getItem(this.sessionKey);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }
    
    /**
     * Clear session
     */
    clearSession() {
        sessionStorage.removeItem(this.sessionKey);
        this.authorized = false;
        this.adminToken = null;
    }
    
    /**
     * Handle unauthorized
     */
    handleUnauthorized() {
        this.clearSession();
        alert('Session expired. Please login again.');
        this.requireAuth();
    }
    
    /**
     * Require authentication
     */
    async requireAuth() {
        if (this.authorized) return true;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: rgba(31, 41, 55, 0.95);
                border: 2px solid #8b5cf6;
                border-radius: 1rem;
                padding: 3rem;
                max-width: 500px;
                text-align: center;
            ">
                <h2 style="color: #8b5cf6; margin-bottom: 1rem;">
                    🔐 Admin Authentication Required
                </h2>
                <p style="color: #d1d5db; margin-bottom: 2rem;">
                    Connect your admin wallet and enter your PIN to access this panel.
                </p>
                <button onclick="adminAuth.connectAdminWallet()" style="
                    background: linear-gradient(135deg, #8b5cf6, #ec4899);
                    border: none;
                    color: white;
                    padding: 1rem 2rem;
                    border-radius: 0.5rem;
                    font-size: 1.1rem;
                    font-weight: 600;
                    cursor: pointer;
                ">Connect Admin Wallet</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        return false;
    }
    
    /**
     * Protect page
     */
    protectPage() {
        if (!this.authorized) {
            // Don't hide the body - just show auth modal
            this.requireAuth();
            return false;
        }
        return true;
    }
}

// Create global instance
window.adminAuth = new SupabaseAdminAuth();

// Auto-protect on load
document.addEventListener('DOMContentLoaded', () => {
    window.adminAuth.protectPage();
});

// Also make available the bs58 encode function if not already loaded
if (typeof bs58 === 'undefined') {
    window.bs58 = {
        encode: function(buffer) {
            const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
            const bytes = new Uint8Array(buffer);
            const digits = [0];
            
            for (let i = 0; i < bytes.length; i++) {
                let carry = bytes[i];
                for (let j = 0; j < digits.length; j++) {
                    carry += digits[j] << 8;
                    digits[j] = carry % 58;
                    carry = (carry / 58) | 0;
                }
                while (carry > 0) {
                    digits.push(carry % 58);
                    carry = (carry / 58) | 0;
                }
            }
            
            let string = '';
            for (let i = 0; bytes[i] === 0 && i < bytes.length - 1; i++) {
                string += ALPHABET[0];
            }
            for (let i = digits.length - 1; i >= 0; i--) {
                string += ALPHABET[digits[i]];
            }
            
            return string;
        }
    };
}

console.log('🔐 Supabase Admin Authentication loaded');
console.log('📋 Using PostgreSQL RPC functions for security');