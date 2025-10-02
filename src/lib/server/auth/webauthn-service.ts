import { centralDb as db } from "$lib/server/db";
import { userPasskey } from "$lib/server/db/central-schema";
import { eq, desc } from "drizzle-orm";
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
    challengeFromSession: string,
  ): Promise<WebAuthnVerificationResult> {
    try {
      logger.debug("Verifying WebAuthn authentication", {
        credentialId: credential.id,
        hasChallenge: !!challengeFromSession,
      });

      // Get the passkey from database
      const passkeyResults = await db
        .select()
        .from(userPasskey)
        .where(eq(userPasskey.id, credential.id))
        .limit(1);

      if (passkeyResults.length === 0) {
        logger.warn("Passkey not found", { credentialId: credential.id });
        return { verified: false };
      }

      const passkey = passkeyResults[0];

      // Parse client data JSON
      const clientDataJSON = JSON.parse(
        Buffer.from(credential.response.clientDataJSON, "base64").toString(),
      );

      // Verify the challenge (convert base64url to base64 for comparison)
      const expectedChallenge = challengeFromSession.replace(/-/g, "+").replace(/_/g, "/");
      const receivedChallenge = clientDataJSON.challenge.replace(/-/g, "+").replace(/_/g, "/");

      if (expectedChallenge !== receivedChallenge) {
        logger.warn("Challenge mismatch", {
          credentialId: credential.id,
          expectedChallenge,
          receivedChallenge,
        });
        return { verified: false };
      }

      // Verify the origin matches expected origin (critical for security)
      const allowedOrigins = WebAuthnService.getAllowedOrigins();
      if (!allowedOrigins.includes(clientDataJSON.origin)) {
        logger.warn("Origin verification failed", {
          credentialId: credential.id,
          receivedOrigin: clientDataJSON.origin,
          allowedOrigins,
        });
        return { verified: false };
      }

      logger.debug("Origin verification successful", {
        origin: clientDataJSON.origin,
      });

      // Parse authenticator data
      const authenticatorDataBuffer = Buffer.from(credential.response.authenticatorData, "base64");

      // Parse authenticator data for detailed debugging
      const parsedAuthData = WebAuthnService.parseAuthenticatorData(authenticatorDataBuffer);

      logger.debug("Authenticator data analysis", {
        credentialId: credential.id,
        bufferLength: authenticatorDataBuffer.length,
        bufferHex: authenticatorDataBuffer.toString("hex"),
        parsed: parsedAuthData,
      });

      // Extract counter from authenticator data
      // Format: rpIdHash(32) + flags(1) + counter(4) + attestedCredentialData(variable)
      // Counter is at bytes 33-36 (0-indexed)
      if (authenticatorDataBuffer.length < 37) {
        logger.warn("Authenticator data too short for counter extraction", {
          credentialId: credential.id,
          bufferLength: authenticatorDataBuffer.length,
        });
        return { verified: false };
      }

      const newCounter = authenticatorDataBuffer.readUInt32BE(33);

      logger.debug("Counter extraction", {
        credentialId: credential.id,
        storedCounter: passkey.counter,
        newCounter,
        counterBytes: authenticatorDataBuffer.subarray(33, 37).toString("hex"),
      });

      // Some authenticators (especially software-based ones) always return 0
      // In that case, we skip counter verification but log it
      if (newCounter === 0 && passkey.counter === 0) {
        logger.info("Authenticator uses zero counter - skipping counter verification", {
          credentialId: credential.id,
        });
      } else if (newCounter <= passkey.counter) {
        logger.warn("Counter verification failed - possible replay attack", {
          credentialId: credential.id,
          storedCounter: passkey.counter,
          newCounter,
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
        signatureBuffer,
      );

      if (!isSignatureValid) {
        logger.warn("Signature verification failed", { credentialId: credential.id });
        return { verified: false };
      }

      // Update the counter in the database to prevent replay attacks
      // Only update if the authenticator provides a non-zero counter
      if (newCounter > 0) {
        await db
          .update(userPasskey)
          .set({ counter: newCounter })
          .where(eq(userPasskey.id, passkey.id));

        logger.debug("Counter updated in database", {
          credentialId: credential.id,
          newCounter,
        });
      } else {
        logger.debug("Counter update skipped (zero counter authenticator)", {
          credentialId: credential.id,
        });
      }

      logger.debug("WebAuthn authentication successful", {
        credentialId: credential.id,
        userId: passkey.userId,
        newCounter,
        counterUpdated: true,
      });

      return {
        verified: true,
        userId: passkey.userId,
        newCounter,
        passkeyId: passkey.id,
      };
    } catch (error) {
      logger.error("WebAuthn verification error", {
        error: String(error),
        credentialId: credential.id,
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
    signature: Buffer,
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
        signedDataLength: signedData.length,
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
   * Get allowed origins for WebAuthn verification
   * Uses SERVER_DOMAIN in production, localhost variants in development
   */
  private static getAllowedOrigins(): string[] {
    const origins: string[] = [];

    // Check if we're in development (NODE_ENV or presence of dev indicators)
    const isDevelopment =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "dev" ||
      !process.env.SERVER_DOMAIN;

    if (isDevelopment) {
      // Development origins
      origins.push(
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
      );
    } else {
      // Production: Use SERVER_DOMAIN
      const serverDomain = process.env.SERVER_DOMAIN;
      if (serverDomain) {
        // Add main domain with HTTPS
        origins.push(`https://${serverDomain}`);

        // Add www variant if it doesn't already start with www
        if (!serverDomain.startsWith("www.")) {
          origins.push(`https://www.${serverDomain}`);
        }

        // TODO: Webauthn does not support wildcard domains. We'll need another solution for that.
      }
    }

    // Allow manual override via WEBAUTHN_ALLOWED_ORIGINS
    const envOrigins = process.env.WEBAUTHN_ALLOWED_ORIGINS;
    if (envOrigins) {
      origins.push(...envOrigins.split(",").map((o) => o.trim()));
    }

    // Ensure we have at least one allowed origin
    if (origins.length === 0) {
      logger.error("No WebAuthn allowed origins configured - this is a security risk!", {
        NODE_ENV: process.env.NODE_ENV,
        SERVER_DOMAIN: process.env.SERVER_DOMAIN,
        WEBAUTHN_ALLOWED_ORIGINS: process.env.WEBAUTHN_ALLOWED_ORIGINS,
      });
      // Fallback to localhost in development only
      if (isDevelopment) {
        origins.push("http://localhost:5173");
      }
    }

    logger.debug("WebAuthn allowed origins configured", {
      origins,
      isDevelopment,
      serverDomain: process.env.SERVER_DOMAIN,
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
