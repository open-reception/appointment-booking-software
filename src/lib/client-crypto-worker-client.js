/**
 * Client Crypto Worker Client
 * 
 * Helper class for communicating with the client crypto worker from the main thread.
 * Provides a Promise-based API for all crypto operations for patients/clients.
 */

export class ClientCryptoWorkerClient {
    constructor() {
        this.worker = null;
        this.messageHandlers = new Map();
        this.messageIdCounter = 0;
        this.isInitialized = false;
    }
    
    /**
     * Initialize the client crypto worker
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        
        try {
            this.worker = new Worker('/src/lib/client-crypto-worker.js', { type: 'module' });
            
            this.worker.onmessage = (event) => {
                this.handleWorkerMessage(event);
            };
            
            this.worker.onerror = (error) => {
                console.error('[ClientCryptoWorkerClient] Worker error:', error);
            };
            
            this.isInitialized = true;
            console.log('[ClientCryptoWorkerClient] Initialized');
            
        } catch (error) {
            console.error('[ClientCryptoWorkerClient] Failed to initialize worker:', error);
            throw error;
        }
    }
    
    /**
     * Handle messages from the worker
     * @param {MessageEvent} event - Message event from worker
     */
    handleWorkerMessage(event) {
        const { type, messageId, success, data, error } = event.data;
        
        if (type === 'response' && this.messageHandlers.has(messageId)) {
            const { resolve, reject } = this.messageHandlers.get(messageId);
            this.messageHandlers.delete(messageId);
            
            if (success) {
                resolve(data);
            } else {
                reject(new Error(error.message || 'Unknown error'));
            }
        } else if (type === 'session-expired') {
            // Handle session expiration
            this.onSessionExpired(data);
        }
    }
    
    /**
     * Send message to worker and wait for response
     * @param {string} type - Message type
     * @param {Object} payload - Message payload
     * @returns {Promise<any>} Worker response
     */
    sendMessage(type, payload = {}) {
        if (!this.isInitialized || !this.worker) {
            throw new Error('Worker not initialized');
        }
        
        return new Promise((resolve, reject) => {
            const messageId = ++this.messageIdCounter;
            
            this.messageHandlers.set(messageId, { resolve, reject });
            
            this.worker?.postMessage({
                type,
                payload,
                messageId
            });
            
            // Set timeout for response
            setTimeout(() => {
                if (this.messageHandlers.has(messageId)) {
                    this.messageHandlers.delete(messageId);
                    reject(new Error('Worker response timeout'));
                }
            }, 30000); // 30 second timeout
        });
    }
    
    /**
     * Authenticate client using email + PIN + privateKeyShare
     * @param {string} clientEmail - Client email address
     * @param {string} pin - 6-digit PIN
     * @param {string} privateKeyShare - Base64 encoded private key share from server
     * @returns {Promise<Object>} Authentication result
     */
    async authenticate(clientEmail, pin, privateKeyShare) {
        console.log('[ClientCryptoWorkerClient] Authenticating client:', clientEmail);
        
        try {
            const result = await this.sendMessage('authenticate', {
                clientEmail,
                pin,
                privateKeyShare
            });
            
            console.log('[ClientCryptoWorkerClient] Authentication successful');
            return result;
            
        } catch (error) {
            console.error('[ClientCryptoWorkerClient] Authentication failed:', error);
            throw error;
        }
    }
    
    /**
     * Decrypt appointment data
     * @param {Object} appointmentData - Encrypted appointment data
     * @param {string} appointmentData.encryptedData - Encrypted data
     * @param {string} appointmentData.clientKeyShare - Client's encrypted key share
     * @returns {Promise<Object>} Decrypted appointment data
     */
    async decryptAppointment(appointmentData) {
        console.log('[ClientCryptoWorkerClient] Decrypting appointment');
        
        try {
            const result = await this.sendMessage('decrypt-appointment', {
                encryptedData: appointmentData.encryptedData,
                clientKeyShare: appointmentData.clientKeyShare
            });
            
            console.log('[ClientCryptoWorkerClient] Appointment decrypted successfully');
            return result;
            
        } catch (error) {
            console.error('[ClientCryptoWorkerClient] Decryption failed:', error);
            
            // If authentication required, could trigger re-auth here
            if (error instanceof Error && (error.message.includes('Not authenticated') || error.message.includes('expired'))) {
                this.onAuthenticationRequired();
            }
            
            throw error;
        }
    }
    
    /**
     * Get current worker status
     * @returns {Promise<Object>} Status information
     */
    async getStatus() {
        try {
            return await this.sendMessage('get-status');
        } catch (error) {
            console.error('[ClientCryptoWorkerClient] Failed to get status:', error);
            throw error;
        }
    }
    
    /**
     * Logout and clear all crypto data
     * @returns {Promise<Object>} Logout confirmation
     */
    async logout() {
        console.log('[ClientCryptoWorkerClient] Logging out');
        
        try {
            const result = await this.sendMessage('logout');
            console.log('[ClientCryptoWorkerClient] Logged out successfully');
            return result;
            
        } catch (error) {
            console.error('[ClientCryptoWorkerClient] Logout failed:', error);
            throw error;
        }
    }
    
    /**
     * Terminate the worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
            this.messageHandlers.clear();
            console.log('[ClientCryptoWorkerClient] Worker terminated');
        }
    }
    
    /**
     * Handle session expiration (override in your app)
     * @param {any} data - Expiration data
     */
    onSessionExpired(data) {
        console.log('[ClientCryptoWorkerClient] Session expired for client:', data?.clientEmail || 'unknown');
        // Override this method in your application to handle session expiration
        // e.g., show re-authentication dialog, redirect to login, etc.
    }
    
    /**
     * Handle authentication required (override in your app)
     */
    onAuthenticationRequired() {
        console.log('[ClientCryptoWorkerClient] Authentication required');
        // Override this method in your application to handle auth requirement
        // e.g., show authentication dialog, redirect to login, etc.
    }
}

// Export singleton instance
export const clientCryptoWorker = new ClientCryptoWorkerClient();