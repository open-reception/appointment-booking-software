import { centralDb } from "$lib/server/db";
import { userPasskey } from "$lib/server/db/central-schema";
import { eq } from "drizzle-orm";
import { randomBytes, createHash } from "node:crypto";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("WebAuthnService");

export interface WebAuthnCredential {
	id: string;
	response: {
		authenticatorData: string;
		signature: string;
		userHandle?: string;
		clientDataJSON: string;
	};
}

export interface WebAuthnVerificationResult {
	verified: boolean;
	userId?: string;
	newCounter?: number;
	passkeyId?: string;
}

export class WebAuthnService {
	/**
	 * Verify a WebAuthn authentication assertion
	 * @param credential - The WebAuthn credential from the client
	 * @param challengeFromSession - The challenge that was sent to the client (should be stored in session)
	 * @returns Verification result with user ID if successful
	 */
	static async verifyAuthentication(
		credential: WebAuthnCredential,
		challengeFromSession: string
	): Promise<WebAuthnVerificationResult> {
		try {
			logger.debug("Verifying WebAuthn authentication", {
				credentialId: credential.id,
				hasChallenge: !!challengeFromSession
			});

			// Get the passkey from database
			const passkeys = await centralDb
				.select()
				.from(userPasskey)
				.where(eq(userPasskey.id, credential.id))
				.limit(1);

			if (passkeys.length === 0) {
				logger.warn("Passkey not found", { credentialId: credential.id });
				return { verified: false };
			}

			const passkey = passkeys[0];

			// Parse client data JSON
			const clientDataJSON = JSON.parse(
				Buffer.from(credential.response.clientDataJSON, "base64").toString()
			);

			// Verify the challenge (convert base64url to base64 for comparison)
			const expectedChallenge = challengeFromSession.replace(/-/g, "+").replace(/_/g, "/");
			const receivedChallenge = clientDataJSON.challenge.replace(/-/g, "+").replace(/_/g, "/");

			if (expectedChallenge !== receivedChallenge) {
				logger.warn("Challenge mismatch", {
					credentialId: credential.id,
					expectedChallenge: expectedChallenge.substring(0, 8) + "...",
					receivedChallenge: receivedChallenge.substring(0, 8) + "..."
				});
				return { verified: false };
			}

			// Verify the origin (in production, this should match your domain)
			// For now, we'll skip this check as it depends on your deployment configuration
			logger.debug("Origin verification skipped (implement for production)", {
				origin: clientDataJSON.origin
			});

			// Parse authenticator data
			const authenticatorDataBuffer = Buffer.from(credential.response.authenticatorData, "base64");

			// Extract counter from authenticator data (bytes 33-36)
			const newCounter = authenticatorDataBuffer.readUInt32BE(33);

			// Verify counter is greater than stored counter (prevents replay attacks)
			if (newCounter <= passkey.counter) {
				logger.warn("Counter verification failed - possible replay attack", {
					credentialId: credential.id,
					storedCounter: passkey.counter,
					newCounter
				});
				return { verified: false };
			}

			// Create the data to be signed
			const clientDataHash = createHash("sha256")
				.update(Buffer.from(credential.response.clientDataJSON, "base64"))
				.digest();

			const signedData = Buffer.concat([authenticatorDataBuffer, clientDataHash]);

			// Verify the signature
			const publicKeyBuffer = Buffer.from(passkey.publicKey, "base64");
			const signatureBuffer = Buffer.from(credential.response.signature, "base64");

			const isSignatureValid = await this.verifySignature(
				publicKeyBuffer,
				signedData,
				signatureBuffer
			);

			if (!isSignatureValid) {
				logger.warn("Signature verification failed", { credentialId: credential.id });
				return { verified: false };
			}

			logger.debug("WebAuthn authentication successful", {
				credentialId: credential.id,
				userId: passkey.userId,
				newCounter
			});

			return {
				verified: true,
				userId: passkey.userId,
				newCounter,
				passkeyId: passkey.id
			};
		} catch (error) {
			logger.error("WebAuthn verification error", {
				error: String(error),
				credentialId: credential.id
			});
			return { verified: false };
		}
	}

	/**
	 * Verify a signature using the stored public key
	 * This is a simplified implementation - in production, you should use a proper WebAuthn library
	 * like @simplewebauthn/server for complete verification
	 */
	private static async verifySignature(
		publicKey: Buffer,
		signedData: Buffer,
		signature: Buffer
	): Promise<boolean> {
		try {
			const crypto = await import("node:crypto");

			// This is a simplified implementation
			// In production, you should use a proper WebAuthn library that handles:
			// - Different key formats (COSE, etc.)
			// - Different signature algorithms
			// - Proper ASN.1 parsing
			// - Certificate chain validation

			// For now, we'll assume ES256 (ECDSA P-256 with SHA-256)
			// and that the public key is in the correct format

			const verify = crypto.createVerify("SHA256");
			verify.update(signedData);
			verify.end();

			// This is a placeholder - proper implementation would:
			// 1. Parse the COSE key format
			// 2. Convert to the correct format for Node.js crypto
			// 3. Handle different algorithms properly

			logger.debug("Signature verification (simplified implementation)", {
				publicKeyLength: publicKey.length,
				signatureLength: signature.length,
				signedDataLength: signedData.length
			});

			// For development, we'll return true if all data is present
			// TODO: Replace with proper signature verification
			return publicKey.length > 0 && signature.length > 0 && signedData.length > 0;
		} catch (error) {
			logger.error("Signature verification error", { error: String(error) });
			return false;
		}
	}

	/**
	 * Generate a random challenge for WebAuthn authentication
	 * This should be stored in the session and used for verification
	 */
	static generateChallenge(): string {
		return randomBytes(32).toString("base64url");
	}

	/**
	 * Update the counter for a passkey after successful authentication
	 */
	static async updatePasskeyCounter(passkeyId: string, newCounter: number): Promise<void> {
		await centralDb
			.update(userPasskey)
			.set({
				counter: newCounter,
				lastUsedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(userPasskey.id, passkeyId));

		logger.debug("Passkey counter updated", { passkeyId, newCounter });
	}

	/**
	 * Get all passkeys for a user
	 */
	static async getUserPasskeys(userId: string) {
		return await centralDb.select().from(userPasskey).where(eq(userPasskey.userId, userId));
	}
}
