/**
 * Crypto Worker for Staff Appointment Decryption
 *
 * This worker handles all cryptographic operations for staff members in an isolated context.
 * Private keys never leave this worker's memory space, providing protection against XSS
 * and other main thread vulnerabilities.
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

class StaffCryptoWorker {
	constructor() {
		this.privateKey = null;
		this.keyExpiry = null;
		this.staffId = null;
		this.cleanupTimer = null;

		// Worker message handler
		self.onmessage = (event) => {
			this.handleMessage(event);
		};

		console.log("[CryptoWorker] Initialized");
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
			console.error("[CryptoWorker] Error:", error);

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
	 * Authenticate staff member and derive encryption key from WebAuthn response
	 * @param {Object} payload - Authentication payload
	 * @param {string} payload.staffId - Staff member ID
	 * @param {ArrayBuffer} payload.webAuthnResponse - WebAuthn response from main thread
	 * @returns {Promise<Object>} Authentication result
	 */
	async authenticate({ staffId, webAuthnResponse }) {
		console.log("[CryptoWorker] Starting authentication for staff:", staffId);

		if (!staffId) {
			throw new Error("Staff ID is required");
		}

		if (!webAuthnResponse) {
			throw new Error("WebAuthn response is required");
		}

		try {
			// Derive Kyber key pair from WebAuthn response (from main thread)
			this.privateKey = await this.derivePrivateKeyFromWebAuthn(staffId, webAuthnResponse);
			this.staffId = staffId;
			this.keyExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

			// Set up automatic cleanup
			this.setupCleanup();

			console.log("[CryptoWorker] Authentication successful");

			return {
				authenticated: true,
				expiresAt: this.keyExpiry,
				staffId: this.staffId
			};
		} catch (error) {
			console.error("[CryptoWorker] Authentication failed:", error);
			this.cleanup();
			if (error instanceof Error) throw new Error("Authentication failed: " + error.message);
			else throw error;
		}
	}

	/**
	 * Decrypt appointment data using the staff member's private key
	 * @param {Object} payload - Decryption payload
	 * @param {string} payload.encryptedData - Base64 encoded encrypted appointment data
	 * @param {string} payload.staffKeyShare - Staff's encrypted symmetric key
	 * @returns {Promise<Object>} Decrypted appointment data
	 */
	async decryptAppointment({ encryptedData, staffKeyShare }) {
		console.log("[CryptoWorker] Decrypting appointment data");

		// Check if authenticated and key not expired
		if (!this.privateKey) {
			throw new Error("Not authenticated - please authenticate first");
		}

		if (Date.now() > (this.keyExpiry ?? 0)) {
			this.cleanup();
			throw new Error("Session expired - please authenticate again");
		}

		if (!encryptedData || !staffKeyShare) {
			throw new Error("Missing required decryption data");
		}

		try {
			// Step 1: Decrypt the symmetric key using staff's Kyber private key
			const symmetricKeyBytes = await this.decryptSymmetricKey(staffKeyShare);

			// Step 2: Decrypt the appointment data using the symmetric key
			const decryptedData = await this.decryptWithSymmetricKey(encryptedData, symmetricKeyBytes);

			// Parse the decrypted JSON
			const appointmentData = JSON.parse(decryptedData);

			console.log("[CryptoWorker] Appointment decrypted successfully");

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
			console.error("[CryptoWorker] Decryption failed:", error);
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
			staffId: this.staffId,
			expiresAt: this.keyExpiry,
			timeRemaining: this.keyExpiry ? Math.max(0, this.keyExpiry - Date.now()) : 0
		};
	}

	/**
	 * Logout and clear all sensitive data
	 * @returns {Object} Logout confirmation
	 */
	logout() {
		console.log("[CryptoWorker] Logging out");
		this.cleanup();
		return { loggedOut: true };
	}

	/**
	 * Derive private key from WebAuthn response using HKDF
	 * @param {string} staffId - Staff member ID
	 * @param {ArrayBuffer} webAuthnResponse - WebAuthn authenticator response from main thread
	 * @returns {Promise<Object>} Kyber key pair object
	 */
	async derivePrivateKeyFromWebAuthn(staffId, webAuthnResponse) {
		// Use WebAuthn response to derive deterministic key material using Web Crypto API HKDF

		// Input Key Material (IKM) - combine staffId with WebAuthn response
		const staffIdBytes = BufferUtils.from(staffId);
		const responseBytes = new Uint8Array(webAuthnResponse);
		const ikm = new Uint8Array(BufferUtils.concat([staffIdBytes, responseBytes]));

		// Import the IKM as a CryptoKey for HKDF
		const ikmKey = await crypto.subtle.importKey(
			"raw",
			ikm, // Direct Uint8Array is BufferSource compatible
			"HKDF",
			false,
			["deriveBits"]
		);

		// Salt for HKDF
		const salt = new Uint8Array(BufferUtils.from("OpenReception-Staff-KeyDerivation-v1"));

		// Info for HKDF (domain separation)
		const info = new Uint8Array(BufferUtils.from(`staff-kyber-keypair-${staffId}`));

		// Derive deterministic seed material using Web Crypto API HKDF
		// We need enough entropy for Kyber key generation (64 bytes = 512 bits)
		const keyMaterial = await crypto.subtle.deriveBits(
			{
				name: "HKDF",
				hash: "SHA-256",
				salt: salt, // Direct Uint8Array is BufferSource compatible
				info: info // Direct Uint8Array is BufferSource compatible
			},
			ikmKey,
			512 // 64 bytes * 8 bits
		);

		// Generate deterministic Kyber key pair from the derived seed
		const keyPair = this.generateDeterministicKyberKeyPair(new Uint8Array(keyMaterial));

		console.log("[CryptoWorker] Generated deterministic Kyber key pair for staff:", staffId);
		return keyPair;
	}

	/**
	 * Generate deterministic Kyber key pair from seed material
	 * @param {Uint8Array} seedMaterial - Deterministic seed material from HKDF (64 bytes)
	 * @returns {Object} Kyber key pair
	 */
	generateDeterministicKyberKeyPair(seedMaterial) {
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
	 * Decrypt symmetric key using staff's Kyber private key
	 * @param {string} staffKeyShare - Base64 encoded encapsulated symmetric key
	 * @returns {Promise<Uint8Array>} Decrypted symmetric key bytes
	 */
	async decryptSymmetricKey(staffKeyShare) {
		if (!this.privateKey) {
			throw new Error("Private key not available for decryption");
		}

		// Decode the base64 encoded encapsulated secret
		const encapsulatedSecret = BufferUtils.from(staffKeyShare, "hex");

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
			console.log("[CryptoWorker] Session expired, cleaning up");
			this.cleanup();

			// Notify main thread of expiration
			self.postMessage({
				type: "session-expired",
				staffId: this.staffId
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
		this.staffId = null;

		// Force garbage collection of sensitive data
		if (typeof gc !== "undefined") {
			gc();
		}

		console.log("[CryptoWorker] Cleanup completed");
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
const cryptoWorker = new StaffCryptoWorker();
