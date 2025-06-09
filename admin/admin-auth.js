// admin-auth.js
// Enhanced authentication system for WalletWars admin panel
// This provides an additional layer of security beyond .htaccess

class AdminAuth {
    constructor() {
        this.sessionKey = 'walletwars_admin_session';
        this.authorized = false;
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.lastActivity = null;
        
        // Authorized admin wallets (add your admin wallet here)
        this.authorizedWallets = [
            '6PoB9i9kpumDze7EhiL3CicAuEPxDAzrTVzHYot9sx9h', // Your admin wallet
            // Add more admin wallets as needed
        ];
        
        this.init();
    }
    
    init() {
        // Check for existing session
        this.checkSession();
        
        // Monitor activity
        this.setupActivityMonitor();
        
        // Check wallet on page load
        this.setupWalletCheck();
    }
    
    /**
     * Check if user has valid session
     */
    checkSession() {
        const session = this.getSession();
        
        if (session && session.expires > Date.now()) {
            this.authorized = true;
            this.lastActivity = Date.now();
            console.log('✅ Valid admin session found');
        } else {
            this.clearSession();
            console.log('❌ No valid admin session');
        }
        
        return this.authorized;
    }
    
    /**
     * Create admin session
     */
    createSession(walletAddress) {
        const session = {
            wallet: walletAddress,
            created: Date.now(),
            expires: Date.now() + this.sessionTimeout,
            ip: 'logged' // In production, log actual IP
        };
        
        localStorage.setItem(this.sessionKey, JSON.stringify(session));
        this.authorized = true;
        this.lastActivity = Date.now();
        
        console.log('✅ Admin session created');
        this.logAccess('login', walletAddress);
    }
    
    /**
     * Get current session
     */
    getSession() {
        try {
            const data = localStorage.getItem(this.sessionKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Clear session
     */
    clearSession() {
        localStorage.removeItem(this.sessionKey);
        this.authorized = false;
        console.log('🗑️ Admin session cleared');
    }
    
    /**
     * Setup activity monitor
     */
    setupActivityMonitor() {
        // Reset timeout on any activity
        ['click', 'keypress', 'mousemove'].forEach(event => {
            document.addEventListener(event, () => {
                if (this.authorized) {
                    this.lastActivity = Date.now();
                }
            });
        });
        
        // Check for timeout every minute
        setInterval(() => {
            if (this.authorized && this.lastActivity) {
                const idle = Date.now() - this.lastActivity;
                if (idle > this.sessionTimeout) {
                    this.handleTimeout();
                }
            }
        }, 60000);
    }
    
    /**
     * Handle session timeout
     */
    handleTimeout() {
        this.clearSession();
        alert('⏱️ Admin session expired. Please reconnect your wallet.');
        this.requireAuth();
    }
    
    /**
     * Setup wallet check
     */
    setupWalletCheck() {
        // Wait for wallet to be available
        const checkWallet = setInterval(() => {
            if (window.phantom?.solana || window.solana) {
                clearInterval(checkWallet);
                this.verifyAdminWallet();
            }
        }, 1000);
    }
    
    /**
     * Verify admin wallet
     */
    async verifyAdminWallet() {
        try {
            const provider = window.phantom?.solana || window.solana;
            
            if (!provider) {
                console.log('⚠️ No wallet provider found');
                return false;
            }
            
            // Try to connect silently first
            let publicKey;
            if (provider.isConnected) {
                publicKey = provider.publicKey;
            } else {
                try {
                    const response = await provider.connect({ onlyIfTrusted: true });
                    publicKey = response.publicKey;
                } catch (error) {
                    console.log('📱 Wallet not connected');
                    return false;
                }
            }
            
            const walletAddress = publicKey.toString();
            
            // Check if wallet is authorized
            if (this.authorizedWallets.includes(walletAddress)) {
                console.log('✅ Admin wallet verified:', walletAddress);
                this.createSession(walletAddress);
                return true;
            } else {
                console.log('❌ Wallet not authorized for admin access');
                this.showUnauthorized();
                return false;
            }
            
        } catch (error) {
            console.error('Error verifying wallet:', error);
            return false;
        }
    }
    
    /**
     * Require authentication
     */
    async requireAuth() {
        if (this.authorized) return true;
        
        const authModal = document.createElement('div');
        authModal.style.cssText = `
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
        
        authModal.innerHTML = `
            <div style="
                background: rgba(31, 41, 55, 0.95);
                border: 2px solid #8b5cf6;
                border-radius: 1rem;
                padding: 3rem;
                max-width: 500px;
                text-align: center;
            ">
                <h2 style="color: #8b5cf6; margin-bottom: 1rem;">🔐 Admin Authentication Required</h2>
                <p style="color: #d1d5db; margin-bottom: 2rem;">
                    Please connect your admin wallet to access this panel.
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
                
                <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid rgba(139, 92, 246, 0.3);">
                    <p style="color: #9ca3af; font-size: 0.9rem;">
                        Only authorized admin wallets can access this panel.<br>
                        Your connection will be logged for security.
                    </p>
                </div>
            </div>
        `;
        
        document.body.appendChild(authModal);
    }
    
    /**
     * Connect admin wallet
     */
    async connectAdminWallet() {
        try {
            const provider = window.phantom?.solana || window.solana;
            
            if (!provider) {
                alert('Please install Phantom wallet to access admin panel');
                return;
            }
            
            const response = await provider.connect();
            const walletAddress = response.publicKey.toString();
            
            if (this.authorizedWallets.includes(walletAddress)) {
                this.createSession(walletAddress);
                location.reload(); // Reload to apply auth
            } else {
                this.showUnauthorized();
            }
            
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            alert('Failed to connect wallet. Please try again.');
        }
    }
    
    /**
     * Show unauthorized message
     */
    showUnauthorized() {
        alert(
            '🚫 Unauthorized Access\n\n' +
            'This wallet is not authorized for admin access.\n' +
            'If you believe this is an error, please contact the system administrator.\n\n' +
            'This attempt has been logged.'
        );
        
        // Log unauthorized attempt
        this.logAccess('unauthorized', 'unknown');
    }
    
    /**
     * Log access attempts
     */
    logAccess(type, wallet) {
        const log = {
            type: type,
            wallet: wallet,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            // In production, also log IP address
        };
        
        // Store in localStorage (in production, send to server)
        const logs = this.getAccessLogs();
        logs.push(log);
        
        // Keep only last 100 logs
        if (logs.length > 100) {
            logs.shift();
        }
        
        localStorage.setItem('walletwars_admin_logs', JSON.stringify(logs));
        
        console.log(`📋 Access logged: ${type} - ${wallet}`);
    }
    
    /**
     * Get access logs
     */
    getAccessLogs() {
        try {
            const data = localStorage.getItem('walletwars_admin_logs');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            return [];
        }
    }
    
    /**
     * Add protection to page
     */
    protectPage() {
        if (!this.authorized) {
            // Hide content
            document.body.style.display = 'none';
            
            // Require auth
            this.requireAuth();
            
            return false;
        }
        
        return true;
    }
    
    /**
     * Get session info
     */
    getSessionInfo() {
        const session = this.getSession();
        if (!session) return null;
        
        const remaining = session.expires - Date.now();
        const minutes = Math.floor(remaining / 60000);
        
        return {
            wallet: session.wallet,
            created: new Date(session.created).toLocaleString(),
            expires: new Date(session.expires).toLocaleString(),
            remaining: `${minutes} minutes`,
            active: this.authorized
        };
    }
}

// Create global instance
window.adminAuth = new AdminAuth();

// Auto-protect page on load
document.addEventListener('DOMContentLoaded', () => {
    window.adminAuth.protectPage();
});

console.log('🔐 Admin authentication system loaded');
console.log('📋 Use adminAuth.getSessionInfo() to check session');
console.log('🔑 Use adminAuth.getAccessLogs() to view access history');