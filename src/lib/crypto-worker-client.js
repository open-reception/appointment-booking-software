/**
 * Crypto Worker Client
 *
 * Helper class for communicating with the crypto worker from the main thread.
 * Provides a Promise-based API for all crypto operations.
 */

export class CryptoWorkerClient {
	constructor() {
		this.worker = null;
		this.messageHandlers = new Map();
		this.messageIdCounter = 0;
		this.isInitialized = false;
	}

	/**
	 * Initialize the crypto worker
	 * @returns {Promise<void>}
	 */
	async initialize() {
		if (this.isInitialized) {
			return;
		}

		try {
			this.worker = new Worker("/src/lib/crypto-worker.js", { type: "module" });

			this.worker.onmessage = (event) => {
				this.handleWorkerMessage(event);
			};

			this.worker.onerror = (error) => {
				console.error("[CryptoWorkerClient] Worker error:", error);
			};

			this.isInitialized = true;
			console.log("[CryptoWorkerClient] Initialized");
		} catch (error) {
			console.error("[CryptoWorkerClient] Failed to initialize worker:", error);
			throw error;
		}
	}

	/**
	 * Handle messages from the worker
	 * @param {MessageEvent} event - Message event from worker
	 */
	handleWorkerMessage(event) {
		const { type, messageId, success, data, error } = event.data;

		if (type === "response" && this.messageHandlers.has(messageId)) {
			const { resolve, reject } = this.messageHandlers.get(messageId);
			this.messageHandlers.delete(messageId);

			if (success) {
				resolve(data);
			} else {
				reject(new Error(error.message || "Unknown error"));
			}
		} else if (type === "session-expired") {
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
			throw new Error("Worker not initialized");
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
					reject(new Error("Worker response timeout"));
				}
			}, 30000); // 30 second timeout
		});
	}

	/**
	 * Authenticate staff member using WebAuthn
	 * @param {string} staffId - Staff member ID
	 * @returns {Promise<Object>} Authentication result
	 */
	async authenticate(staffId) {
		console.log("[CryptoWorkerClient] Authenticating staff:", staffId);

		try {
			// Step 1: Perform WebAuthn authentication in main thread
			const webAuthnResponse = await this.performWebAuthnAuthentication(staffId);

			// Step 2: Send WebAuthn response to worker for key derivation
			const result = await this.sendMessage("authenticate", {
				staffId,
				webAuthnResponse
			});

			console.log("[CryptoWorkerClient] Authentication successful");
			return result;
		} catch (error) {
			console.error("[CryptoWorkerClient] Authentication failed:", error);
			throw error;
		}
	}

	/**
	 * Perform WebAuthn authentication in main thread
	 * @param {string} staffId - Staff member ID
	 * @returns {Promise<ArrayBuffer>} WebAuthn response
	 */
	async performWebAuthnAuthentication(staffId) {
		// TODO: Implement actual WebAuthn flow - this can be adapted after the login/auth frontend code has been merged
		// I would assume that the function can be removed and the webauthn response from the login routes
		// can be used directly in the above authenticate function.

		if (!navigator.credentials) {
			throw new Error("WebAuthn not supported in this browser");
		}

		// Mock WebAuthn challenge and response
		// In real implementation:
		// 1. Get challenge from server
		// 2. Call navigator.credentials.get() with challenge
		// 3. Return authenticator response

		console.log("[CryptoWorkerClient] Performing WebAuthn authentication...");

		// Simulate WebAuthn response (deterministic based on staffId)
		const encoder = new TextEncoder();
		const mockResponse = encoder.encode(`webauthn-response-${staffId}`);

		// Create a proper ArrayBuffer from the Uint8Array
		const buffer = new ArrayBuffer(mockResponse.byteLength);
		const view = new Uint8Array(buffer);
		view.set(mockResponse);

		return buffer;
	}

	/**
	 * Decrypt appointment data
	 * @param {Object} appointmentData - Encrypted appointment data
	 * @param {string} appointmentData.encryptedData - Encrypted data
	 * @param {string} appointmentData.staffKeyShare - Staff's encrypted key share
	 * @returns {Promise<Object>} Decrypted appointment data
	 */
	async decryptAppointment(appointmentData) {
		console.log("[CryptoWorkerClient] Decrypting appointment");

		try {
			const result = await this.sendMessage("decrypt-appointment", {
				encryptedData: appointmentData.encryptedData,
				staffKeyShare: appointmentData.staffKeyShare
			});

			console.log("[CryptoWorkerClient] Appointment decrypted successfully");
			return result;
		} catch (error) {
			console.error("[CryptoWorkerClient] Decryption failed:", error);

			// If authentication required, could trigger re-auth here
			if (
				error instanceof Error &&
				(error.message.includes("Not authenticated") || error.message.includes("expired"))
			) {
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
			return await this.sendMessage("get-status");
		} catch (error) {
			console.error("[CryptoWorkerClient] Failed to get status:", error);
			throw error;
		}
	}

	/**
	 * Logout and clear all crypto data
	 * @returns {Promise<Object>} Logout confirmation
	 */
	async logout() {
		console.log("[CryptoWorkerClient] Logging out");

		try {
			const result = await this.sendMessage("logout");
			console.log("[CryptoWorkerClient] Logged out successfully");
			return result;
		} catch (error) {
			console.error("[CryptoWorkerClient] Logout failed:", error);
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
			console.log("[CryptoWorkerClient] Worker terminated");
		}
	}

	/**
	 * Handle session expiration
	 * @param {any} data - Expiration data
	 */
	onSessionExpired(data) {
		console.log("[CryptoWorkerClient] Session expired for staff:", data?.staffId || "unknown");
		// TODO: This usually means the staff member session has expired and the user should be redirected to the login screen
	}

	/**
	 * Handle authentication required
	 */
	onAuthenticationRequired() {
		console.log("[CryptoWorkerClient] Authentication required");
		// TODO: This should trigger showing the passkey prompt again
	}
}

// Export singleton instance
export const cryptoWorker = new CryptoWorkerClient();
