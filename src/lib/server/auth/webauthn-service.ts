import { centralDb as db } from "$lib/server/db";
import { userPasskey } from "$lib/server/db/central-schema";
import { eq, desc } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { UniversalLogger } from "$lib/logger";
import { verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/types";

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
   * Normalize credential ID to base64url format (defensive measure)
   * Ensures credential IDs are consistently stored and queried
   * @param id - Credential ID (should already be base64url from browser)
   * @returns Normalized credential ID in base64url format
   */
  private static normalizeCredentialId(id: string): string {
    // Convert base64 to base64url if needed
    // Base64url: no +, /, or = characters
    return id.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  /**
   * Verify a WebAuthn authentication assertion using @simplewebauthn/server
   * @param credential - The WebAuthn credential from the client
   * @param challengeFromSession - The challenge that was sent to the client (should be stored in session)
   * @param url - The request URL for dynamic RP ID and origin resolution
   * @returns Verification result with user ID if successful
   */
  static async verifyAuthentication(
    credential: WebAuthnCredential,
    challengeFromSession: string,
    url: URL,
  ): Promise<WebAuthnVerificationResult> {
    try {
      // Normalize credential ID to base64url format
      const normalizedCredentialId = WebAuthnService.normalizeCredentialId(credential.id);

      logger.debug("Verifying WebAuthn authentication", {
        credentialId: normalizedCredentialId.substring(0, 20) + "...",
        credentialIdLength: normalizedCredentialId.length,
        hasChallenge: !!challengeFromSession,
      });

      // Get the passkey from database using normalized ID
      const passkeyResults = await db
        .select()
        .from(userPasskey)
        .where(eq(userPasskey.id, normalizedCredentialId))
        .limit(1);

      if (passkeyResults.length === 0) {
        logger.warn("Passkey not found in database", {
          credentialId: normalizedCredentialId.substring(0, 20) + "...",
        });
        return { verified: false };
      }

      const passkey = passkeyResults[0];

      // Get RP ID and allowed origins from request URL
      const rpID = WebAuthnService.getRPID(url);
      const allowedOrigins = WebAuthnService.getAllowedOrigins(url);

      // Convert base64 to base64url (WebAuthn sends base64, @simplewebauthn expects base64url)
      const base64ToBase64url = (base64: string): string => {
        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      };

      // Convert our credential format to @simplewebauthn format
      const authResponse: AuthenticationResponseJSON = {
        id: normalizedCredentialId,
        rawId: normalizedCredentialId,
        response: {
          authenticatorData: base64ToBase64url(credential.response.authenticatorData),
          clientDataJSON: base64ToBase64url(credential.response.clientDataJSON),
          signature: base64ToBase64url(credential.response.signature),
          userHandle: credential.response.userHandle
            ? base64ToBase64url(credential.response.userHandle)
            : undefined,
        },
        type: "public-key",
        clientExtensionResults: {},
      };

      // Create WebAuthnCredential object for @simplewebauthn/server
      // Note: WebAuthnCredential has specific field names: id, publicKey, counter
      // IMPORTANT: publicKey must be raw COSE-encoded Uint8Array (NOT decoded)
      // @simplewebauthn/server will decode it internally during verification
      const publicKeyBuffer = Buffer.from(passkey.publicKey, "base64");
      const publicKeyUint8Array = new Uint8Array(publicKeyBuffer);

      const storedCredential = {
        id: credential.id, // Base64URL-encoded credential ID
        publicKey: publicKeyUint8Array, // COSE-encoded public key as Uint8Array
        counter: passkey.counter, // Stored counter value
      };

      logger.debug("WebAuthnCredential object created", {
        id: storedCredential.id.substring(0, 20) + "...",
        publicKeyLength: publicKeyUint8Array.length,
        publicKeyBase64Sample: passkey.publicKey.substring(0, 60) + "...",
        publicKeyBytesFirst10: Array.from(publicKeyUint8Array.slice(0, 10)),
        counter: storedCredential.counter,
        publicKeyType: typeof storedCredential.publicKey,
        publicKeyConstructor: storedCredential.publicKey.constructor.name,
      });

      // Verify the authentication response using @simplewebauthn/server
      const verification = await verifyAuthenticationResponse({
        response: authResponse,
        expectedChallenge: challengeFromSession,
        expectedOrigin: allowedOrigins,
        expectedRPID: rpID,
        credential: storedCredential, // WebAuthnCredential with id, publicKey, counter
        requireUserVerification: false, // Set to true for higher security requirements
      });

      if (!verification.verified) {
        logger.warn("@simplewebauthn verification failed", {
          credentialId: credential.id,
        });
        return { verified: false };
      }

      const { authenticationInfo } = verification;
      const newCounter = authenticationInfo.newCounter;

      // Update the counter in the database to prevent replay attacks
      await db
        .update(userPasskey)
        .set({
          counter: newCounter,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userPasskey.id, normalizedCredentialId));

      logger.info("WebAuthn authentication successful", {
        credentialId: normalizedCredentialId.substring(0, 20) + "...",
        userId: passkey.userId,
        counterUpdated: `${passkey.counter} → ${newCounter}`,
      });

      return {
        verified: true,
        userId: passkey.userId,
        newCounter,
        passkeyId: normalizedCredentialId,
      };
    } catch (error) {
      logger.error("WebAuthn authentication failed", {
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { verified: false };
    }
  }


  /**
   * Verify a WebAuthn registration response using @simplewebauthn/server
   * Extracts the COSE public key from the attestation object
   * @param url - The request URL for dynamic RP ID and origin resolution
   * @returns Object with credentialID (base64url), credentialPublicKey (base64), and counter
   */
  static async verifyRegistration(
    credentialId: string,
    attestationObjectBase64: string,
    clientDataJSONBase64: string,
    challengeFromSession: string,
    url: URL,
  ): Promise<{ credentialID: string; credentialPublicKey: string; counter: number }> {
    try {
      const rpID = WebAuthnService.getRPID(url);
      const allowedOrigins = WebAuthnService.getAllowedOrigins(url);

      // Normalize credential ID immediately
      const normalizedCredentialId = WebAuthnService.normalizeCredentialId(credentialId);

      // Convert base64 to base64url
      const base64ToBase64url = (base64: string): string => {
        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      };

      // Create RegistrationResponseJSON for @simplewebauthn/server
      const registrationResponse: RegistrationResponseJSON = {
        id: normalizedCredentialId,
        rawId: normalizedCredentialId,
        response: {
          attestationObject: base64ToBase64url(attestationObjectBase64),
          clientDataJSON: base64ToBase64url(clientDataJSONBase64),
        },
        type: "public-key",
        clientExtensionResults: {},
      };

      logger.debug("Verifying registration", {
        credentialId: normalizedCredentialId.substring(0, 20) + "...",
        rpID,
        allowedOrigins,
      });

      // Verify the registration response
      const verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge: challengeFromSession,
        expectedOrigin: allowedOrigins,
        expectedRPID: rpID,
        requireUserVerification: false,
      });

      if (!verification.verified) {
        throw new Error("Registration verification failed");
      }

      const { registrationInfo } = verification;
      if (!registrationInfo) {
        throw new Error("No registration info returned");
      }

      // The credentialPublicKey is already in COSE format (Uint8Array)
      // Convert to base64 for storage
      // Note: credential is nested inside registrationInfo
      const credentialPublicKeyBase64 = Buffer.from(registrationInfo.credential.publicKey).toString(
        "base64",
      );

      logger.info("Registration verified successfully", {
        credentialId: normalizedCredentialId.substring(0, 20) + "...",
        credentialIdLength: normalizedCredentialId.length,
        counter: registrationInfo.credential.counter,
        publicKeyLength: registrationInfo.credential.publicKey.length,
        publicKeyBytesFirst10: Array.from(registrationInfo.credential.publicKey.slice(0, 10)),
      });

      return {
        credentialID: normalizedCredentialId, // Normalized to base64url for consistency
        credentialPublicKey: credentialPublicKeyBase64,
        counter: registrationInfo.credential.counter,
      };
    } catch (error) {
      logger.error("Registration verification error", {
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
        credentialId,
      });
      throw error;
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
    await db
      .update(userPasskey)
      .set({
        counter: newCounter,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userPasskey.id, passkeyId));

    logger.debug("Passkey counter updated", { passkeyId, newCounter });
  }

  /**
   * Get all passkeys for a user
   */
  static async getUserPasskeys(userId: string) {
    return await db.select().from(userPasskey).where(eq(userPasskey.userId, userId));
  }

  /**
   * Get the most recently used passkey for a user
   * Used when we need to determine which passkey was used for authentication
   * but the session doesn't store this information directly
   */
  static async getMostRecentPasskey(userId: string): Promise<{
    id: string;
    lastUsedAt: Date | null;
  } | null> {
    const passkeys = await db
      .select({
        id: userPasskey.id,
        lastUsedAt: userPasskey.lastUsedAt,
      })
      .from(userPasskey)
      .where(eq(userPasskey.userId, userId))
      .orderBy(desc(userPasskey.lastUsedAt))
      .limit(1);

    if (passkeys.length === 0) {
      return null;
    }

    return passkeys[0];
  }

  /**
   * Get Relying Party ID for WebAuthn verification
   * Dynamically resolves from request URL to support multi-tenant subdomains
   * @param url - The request URL
   */
  private static getRPID(url: URL): string {
    if (process.env.NODE_ENV === "production") {
      // In production, use the hostname (without subdomain for main domain)
      const hostname = url.hostname;
      const parts = hostname.split(".");

      // If it's a subdomain (e.g., tenant.example.com), use the main domain (example.com)
      // This allows passkeys to work across all subdomains
      if (parts.length > 2) {
        return parts.slice(-2).join(".");
      }
      return hostname;
    }

    // Development: use localhost
    return "localhost";
  }

  /**
   * Get allowed origins for WebAuthn verification
   * Dynamically resolves from request URL to support multi-tenant subdomains
   * @param url - The request URL
   */
  private static getAllowedOrigins(url: URL): string[] {
    const origins: string[] = [];

    if (process.env.NODE_ENV === "production") {
      // Production: Use the request origin
      const origin = url.origin; // e.g., https://tenant.example.com or https://example.com
      origins.push(origin);

      // Also allow the main domain (without subdomain) to support cross-subdomain passkey usage
      const hostname = url.hostname;
      const parts = hostname.split(".");
      if (parts.length > 2) {
        const mainDomain = parts.slice(-2).join(".");
        origins.push(`https://${mainDomain}`);
      }
    } else {
      // Development origins
      origins.push(
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
      );
    }

    // Allow manual override via WEBAUTHN_ALLOWED_ORIGINS
    const envOrigins = process.env.WEBAUTHN_ALLOWED_ORIGINS;
    if (envOrigins) {
      origins.push(...envOrigins.split(",").map((o) => o.trim()));
    }

    logger.debug("WebAuthn allowed origins configured", {
      origins,
      requestOrigin: url.origin,
      hostname: url.hostname,
    });

    return origins;
  }

  /**
   * Parse authenticator data structure for debugging
   */
  private static parseAuthenticatorData(authenticatorDataBuffer: Buffer) {
    if (authenticatorDataBuffer.length < 37) {
      return { error: "Buffer too short" };
    }

    const rpIdHash = authenticatorDataBuffer.subarray(0, 32);
    const flags = authenticatorDataBuffer.readUInt8(32);
    const counter = authenticatorDataBuffer.readUInt32BE(33);

    // Parse flags
    const userPresent = !!(flags & 0x01);
    const userVerified = !!(flags & 0x04);
    const attestedCredentialDataIncluded = !!(flags & 0x40);
    const extensionDataIncluded = !!(flags & 0x80);

    return {
      rpIdHash: rpIdHash.toString("hex"),
      flags: {
        raw: flags,
        userPresent,
        userVerified,
        attestedCredentialDataIncluded,
        extensionDataIncluded,
      },
      counter,
      totalLength: authenticatorDataBuffer.length,
    };
  }

  /**
   * Extract counter from WebAuthn credential response
   * Used during registration to get the initial counter value
   */
  static extractCounterFromCredential(credential: {
    response: {
      authenticatorData: string;
    };
  }): number {
    try {
      // Parse authenticator data
      const authenticatorDataBuffer = Buffer.from(credential.response.authenticatorData, "base64");

      // Extract counter from authenticator data (bytes 33-36)
      const counter = authenticatorDataBuffer.readUInt32BE(33);

      logger.debug("Counter extracted from credential", { counter });
      return counter;
    } catch (error) {
      logger.error("Failed to extract counter from credential", { error: String(error) });
      return 0; // Fallback to 0 if extraction fails
    }
  }
}
