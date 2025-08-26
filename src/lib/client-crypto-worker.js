/**
 * Client Crypto Worker for Patient Appointment Decryption
 *
 * This worker handles cryptographic operations for patients/clients accessing their
 * encrypted appointment data using PIN + privateKeyShare combination.
 *
 * Uses ML-KEM-768 (Kyber) for post-quantum asymmetric encryption and AES-256-GCM for
 * symmetric encryption of appointment data.
 *
 * @author Open Reception Team  
 * @version 1.0.0
 */

// Import crypto utilities
import { KyberCrypto, AESCrypto, BufferUtils } from "./crypto/utils.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem";

class ClientCryptoWorker {
	constructor() {
		this.privateKey = null;
		this.keyExpiry = null;
		this.clientEmail = null;
		this.cleanupTimer = null;

		// Worker message handler
		self.onmessage = (event) => {
			this.handleMessage(event);
		};

		console.log("[ClientCryptoWorker] Initialized");
	}

	/**
	 * Handle messages from the main thread
	 * @param {MessageEvent} event - The message event
	 */
	async handleMessage(event) {
		const { type, payload, messageId } = event.data;

		try {
			let result = null;

			switch (type) {
				case "authenticate":
					result = await this.authenticate(payload);
					break;

				case "decrypt-appointment":
					result = await this.decryptAppointment(payload);
					break;

				case "get-status":
					result = this.getStatus();
					break;

				case "logout":
					result = this.logout();
					break;

				default:
					throw new Error(`Unknown message type: ${type}`);
			}

			// Send success response
			self.postMessage({
				type: "response",
				messageId,
				success: true,
				data: result
			});
		} catch (error) {
			console.error("[ClientCryptoWorker] Error:", error);

			if (error instanceof Error)
				// Send error response
				self.postMessage({
					type: "response",
					messageId,
					success: false,
					error: {
						message: error?.message ?? "ERROR"
					}
				});
		}
	}

	/**
	 * Authenticate client using email + PIN and derive encryption key
	 * @param {Object} payload - Authentication payload
	 * @param {string} payload.clientEmail - Client email address
	 * @param {string} payload.pin - 6-digit PIN
	 * @param {string} payload.privateKeyShare - Base64 encoded private key share from server
	 * @returns {Promise<Object>} Authentication result
	 */
	async authenticate({ clientEmail, pin, privateKeyShare }) {
		console.log("[ClientCryptoWorker] Starting authentication for client:", clientEmail);

		if (!clientEmail || !pin || !privateKeyShare) {
			throw new Error("Client email, PIN, and private key share are required");
		}

		// Validate PIN format (6 digits)
		if (!/^\d{6}$/.test(pin)) {
			throw new Error("PIN must be exactly 6 digits");
		}

		try {
			// Derive Kyber key pair from PIN + privateKeyShare
			this.privateKey = await this.derivePrivateKeyFromPin(clientEmail, pin, privateKeyShare);
			this.clientEmail = clientEmail;
			this.keyExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

			// Set up automatic cleanup
			this.setupCleanup();

			console.log("[ClientCryptoWorker] Authentication successful");

			return {
				authenticated: true,
				expiresAt: this.keyExpiry,
				clientEmail: this.clientEmail
			};
		} catch (error) {
			console.error("[ClientCryptoWorker] Authentication failed:", error);
			this.cleanup();
			if (error instanceof Error) throw new Error("Authentication failed: " + error.message);
			else throw error;
		}
	}

	/**
	 * Decrypt appointment data using the client's private key
	 * @param {Object} payload - Decryption payload
	 * @param {string} payload.encryptedData - Base64 encoded encrypted appointment data
	 * @param {string} payload.clientKeyShare - Client's encrypted symmetric key
	 * @returns {Promise<Object>} Decrypted appointment data
	 */
	async decryptAppointment({ encryptedData, clientKeyShare }) {
		console.log("[ClientCryptoWorker] Decrypting appointment data");

		// Check if authenticated and key not expired
		if (!this.privateKey) {
			throw new Error("Not authenticated - please authenticate first");
		}

		if (Date.now() > (this.keyExpiry ?? 0)) {
			this.cleanup();
			throw new Error("Session expired - please authenticate again");
		}

		if (!encryptedData || !clientKeyShare) {
			throw new Error("Missing required decryption data");
		}

		try {
			// Step 1: Decrypt the symmetric key using client's Kyber private key
			const symmetricKeyBytes = await this.decryptSymmetricKey(clientKeyShare);

			// Step 2: Decrypt the appointment data using the symmetric key
			const decryptedData = await this.decryptWithSymmetricKey(encryptedData, symmetricKeyBytes);

			// Parse the decrypted JSON
			const appointmentData = JSON.parse(decryptedData);

			console.log("[ClientCryptoWorker] Appointment decrypted successfully");

			// Extend session on successful use
			this.keyExpiry = Date.now() + 10 * 60 * 1000;
			this.setupCleanup();

			return {
				title: appointmentData.title,
				description: appointmentData.description,
				clientEmail: appointmentData.clientEmail,
				decryptedAt: new Date().toISOString()
			};
		} catch (error) {
			console.error("[ClientCryptoWorker] Decryption failed:", error);
			if (error instanceof Error)
				throw new Error("Failed to decrypt appointment data: " + error.message);
			else throw error;
		}
	}

	/**
	 * Get current worker status
	 * @returns {Object} Status information
	 */
	getStatus() {
		return {
			authenticated: !!this.privateKey,
			clientEmail: this.clientEmail,
			expiresAt: this.keyExpiry,
			timeRemaining: this.keyExpiry ? Math.max(0, this.keyExpiry - Date.now()) : 0
		};
	}

	/**
	 * Logout and clear all sensitive data
	 * @returns {Object} Logout confirmation
	 */
	logout() {
		console.log("[ClientCryptoWorker] Logging out");
		this.cleanup();
		return { loggedOut: true };
	}

	/**
	 * Derive private key from PIN + privateKeyShare using HKDF
	 * @param {string} clientEmail - Client email address
	 * @param {string} pin - 6-digit PIN
	 * @param {string} privateKeyShare - Base64 encoded private key share
	 * @returns {Promise<Object>} Kyber key pair object
	 */
	async derivePrivateKeyFromPin(clientEmail, pin, privateKeyShare) {
		// Use PIN + privateKeyShare to derive deterministic key material using Web Crypto API HKDF
		
		// Input Key Material (IKM) - combine email + PIN + privateKeyShare
		const emailBytes = BufferUtils.from(clientEmail);
		const pinBytes = BufferUtils.from(pin);
		const keyShareBytes = BufferUtils.from(privateKeyShare, "hex");
		const ikm = new Uint8Array(BufferUtils.concat([emailBytes, pinBytes, keyShareBytes]));

		// Import the IKM as a CryptoKey for HKDF
		const ikmKey = await crypto.subtle.importKey(
			"raw",
			ikm,
			"HKDF",
			false,
			["deriveBits"]
		);

		// Salt for HKDF
		const salt = new Uint8Array(BufferUtils.from("OpenReception-Client-KeyDerivation-v1"));

		// Info for HKDF (domain separation)
		const info = new Uint8Array(BufferUtils.from(`client-kyber-keypair-${clientEmail}`));

		// Derive deterministic seed material using Web Crypto API HKDF
		// We need enough entropy for Kyber key generation (64 bytes = 512 bits)
		const keyMaterial = await crypto.subtle.deriveBits(
			{
				name: "HKDF",
				hash: "SHA-256",
				salt: salt,
				info: info
			},
			ikmKey,
			512 // 64 bytes * 8 bits
		);

		// Generate deterministic Kyber key pair from the derived seed
		const keyPair = this.generateDeterministicKyberKeyPair(new Uint8Array(keyMaterial));

		console.log("[ClientCryptoWorker] Generated deterministic Kyber key pair for client:", clientEmail);
		return keyPair;
	}

	/**
	 * Generate deterministic Kyber key pair from seed material
	 * @param {Uint8Array} seedMaterial - Deterministic seed material from HKDF (64 bytes)
	 * @returns {Object} Kyber key pair
	 */
	generateDeterministicKyberKeyPair(seedMaterial) {
		// ML-KEM-768 keygen accepts a 64-byte seed directly!
		// This is much cleaner than overriding crypto.getRandomValues

		// Ensure we have exactly 64 bytes for ml_kem768.keygen
		const seed =
			seedMaterial.length >= 64
				? seedMaterial.slice(0, 64)
				: new Uint8Array(64).fill(0).map((_, i) => seedMaterial[i % seedMaterial.length]);

		// Use ml_kem768 directly with our deterministic seed
		const keys = ml_kem768.keygen(seed);

		return {
			publicKey: new Uint8Array(keys.publicKey),
			privateKey: new Uint8Array(keys.secretKey)
		};
	}

	/**
	 * Decrypt symmetric key using client's Kyber private key
	 * @param {string} clientKeyShare - Base64 encoded encapsulated symmetric key
	 * @returns {Promise<Uint8Array>} Decrypted symmetric key bytes
	 */
	async decryptSymmetricKey(clientKeyShare) {
		if (!this.privateKey) {
			throw new Error("Private key not available for decryption");
		}

		// Decode the base64 encoded encapsulated secret
		const encapsulatedSecret = BufferUtils.from(clientKeyShare, "hex");

		// Use Kyber to decapsulate the symmetric key
		// this.privateKey is the Kyber key pair object with privateKey property
		const privateKeyBytes = /** @type {any} */ (this.privateKey).privateKey;
		const symmetricKeyBytes = KyberCrypto.decapsulate(privateKeyBytes, encapsulatedSecret);

		return symmetricKeyBytes;
	}

	/**
	 * Decrypt data using symmetric key with AESCrypto
	 * @param {string} encryptedData - Base64 encoded encrypted data
	 * @param {Uint8Array} symmetricKeyBytes - Symmetric decryption key bytes
	 * @returns {Promise<string>} Decrypted data
	 */
	async decryptWithSymmetricKey(encryptedData, symmetricKeyBytes) {
		const combinedBuffer = BufferUtils.from(encryptedData, "hex");

		// Extract IV, auth tag, and encrypted data
		// Format: [IV:16][TAG:16][ENCRYPTED:remaining]
		const iv = combinedBuffer.slice(0, 16);
		const tag = combinedBuffer.slice(16, 32);
		const encrypted = combinedBuffer.slice(32);

		// Use AESCrypto.decrypt with proper parameters
		const decryptedText = await AESCrypto.decrypt(encrypted, symmetricKeyBytes, iv, tag);

		return decryptedText;
	}

	/**
	 * Set up automatic cleanup timer
	 */
	setupCleanup() {
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer);
		}

		const timeUntilExpiry = (this.keyExpiry ?? 0) - Date.now();
		this.cleanupTimer = setTimeout(() => {
			console.log("[ClientCryptoWorker] Session expired, cleaning up");
			this.cleanup();

			// Notify main thread of expiration
			self.postMessage({
				type: "session-expired",
				clientEmail: this.clientEmail
			});
		}, timeUntilExpiry);
	}

	/**
	 * Clear all sensitive data from memory
	 */
	cleanup() {
		if (this.cleanupTimer) {
			clearTimeout(this.cleanupTimer);
			this.cleanupTimer = null;
		}

		this.privateKey = null;
		this.keyExpiry = null;
		this.clientEmail = null;

		// Force garbage collection of sensitive data
		if (typeof gc !== "undefined") {
			gc();
		}

		console.log("[ClientCryptoWorker] Cleanup completed");
	}

	/**
	 * Convert base64 string to ArrayBuffer (kept for compatibility)
	 * @param {string} base64 - Base64 encoded string
	 * @returns {ArrayBuffer} Decoded array buffer
	 */
	base64ToArrayBuffer(base64) {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}

	/**
	 * Convert ArrayBuffer to base64 string (kept for compatibility)
	 * @param {ArrayBuffer} buffer - Array buffer to encode
	 * @returns {string} Base64 encoded string
	 */
	arrayBufferToBase64(buffer) {
		const bytes = new Uint8Array(buffer);
		let binary = "";
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}
}

// Initialize the worker
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const clientCryptoWorker = new ClientCryptoWorker();