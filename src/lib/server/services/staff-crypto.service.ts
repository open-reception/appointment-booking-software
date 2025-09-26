/**
 * Staff Crypto Service
 *
 * Manages cryptographic keys for staff members with split-key architecture:
 * - Public keys are stored in tenant database
 * - Private keys are split into two shards:
 *   - One shard stored in database (encrypted)
 *   - One shard derived from passkey authentication
 */

import { logger } from "$lib/logger";
import { getTenantDb } from "$lib/server/db";
import { staffCrypto } from "$lib/server/db/tenant-schema";
import { eq } from "drizzle-orm";
import { KyberCrypto } from "$lib/crypto/utils";
import crypto from "node:crypto";

export class StaffCryptoService {
  /**
   * Generate keypair for new staff member and store split private key
   * This should be called when a staff member is created
   */
  async generateStaffKeypair(
    tenantId: string,
    userId: string,
    passkeyId: string,
    authenticatorData: ArrayBuffer,
  ): Promise<void> {
    const log = logger.setContext("StaffCryptoService.generateStaffKeypair");

    try {
      log.debug("Generating staff keypair", { tenantId, userId, passkeyId });

      // Generate Kyber keypair
      const keyPair = KyberCrypto.generateKeyPair();

      // Create deterministic shard from passkey data
      const passkeyBasedShard = await this.derivePasskeyBasedShard(passkeyId, authenticatorData);

      // Split private key using XOR (simple but effective for two shards)
      const privateKeyBytes = keyPair.privateKey;
      const dbShard = this.generateRandomShard(privateKeyBytes.length);

      // XOR the private key with the passkey-based shard to get the database shard
      // This ensures: privateKey = dbShard ⊕ passkeyBasedShard
      for (let i = 0; i < privateKeyBytes.length; i++) {
        dbShard[i] = privateKeyBytes[i] ^ passkeyBasedShard[i];
      }

      // Store in database
      const db = await getTenantDb(tenantId);
      await db.insert(staffCrypto).values({
        userId,
        publicKey: this.bufferToBase64(keyPair.publicKey),
        privateKeyShare: this.bufferToBase64(dbShard),
        passkeyId,
        isActive: true,
      });

      log.info("Staff keypair generated and stored", {
        tenantId,
        userId,
        passkeyId,
        publicKeyLength: keyPair.publicKey.length,
        privateShardLength: dbShard.length,
      });
    } catch (error) {
      log.error("Failed to generate staff keypair", {
        tenantId,
        userId,
        passkeyId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Reconstruct private key from database shard and passkey authentication
   */
  async reconstructPrivateKey(
    tenantId: string,
    userId: string,
    passkeyId: string,
    authenticatorData: ArrayBuffer,
  ): Promise<Uint8Array> {
    const log = logger.setContext("StaffCryptoService.reconstructPrivateKey");

    try {
      log.debug("Reconstructing private key", { tenantId, userId, passkeyId });

      // Get database shard
      const db = await getTenantDb(tenantId);
      const result = await db
        .select({
          privateKeyShare: staffCrypto.privateKeyShare,
          passkeyId: staffCrypto.passkeyId,
        })
        .from(staffCrypto)
        .where(eq(staffCrypto.userId, userId))
        .limit(1);

      if (result.length === 0) {
        throw new Error("Staff crypto not found");
      }

      const dbShard = this.base64ToBuffer(result[0].privateKeyShare);
      const storedPasskeyId = result[0].passkeyId;

      // Verify passkey ID matches
      if (storedPasskeyId !== passkeyId) {
        throw new Error("Passkey ID mismatch");
      }

      // Derive passkey-based shard
      const passkeyBasedShard = await this.derivePasskeyBasedShard(passkeyId, authenticatorData);

      // Reconstruct private key using XOR
      const privateKey = new Uint8Array(dbShard.length);
      for (let i = 0; i < dbShard.length; i++) {
        privateKey[i] = dbShard[i] ^ passkeyBasedShard[i];
      }

      log.debug("Private key reconstructed successfully", {
        tenantId,
        userId,
        keyLength: privateKey.length,
      });

      return privateKey;
    } catch (error) {
      log.error("Failed to reconstruct private key", {
        tenantId,
        userId,
        passkeyId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get all staff public keys for a tenant
   */
  async getStaffPublicKeys(
    tenantId: string,
  ): Promise<Array<{ userId: string; publicKey: string }>> {
    const log = logger.setContext("StaffCryptoService.getStaffPublicKeys");

    try {
      const db = await getTenantDb(tenantId);
      const staffWithKeys = await db
        .select({
          userId: staffCrypto.userId,
          publicKey: staffCrypto.publicKey,
        })
        .from(staffCrypto)
        .where(eq(staffCrypto.isActive, true));

      const validStaffKeys = staffWithKeys.map((staff) => ({
        userId: staff.userId,
        publicKey: staff.publicKey,
      }));

      log.info("Retrieved staff public keys", {
        tenantId,
        validKeys: validStaffKeys.length,
      });

      return validStaffKeys;
    } catch (error) {
      log.error("Failed to retrieve staff public keys", {
        tenantId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get public key for specific staff member
   */
  async getStaffPublicKey(tenantId: string, userId: string): Promise<string | null> {
    const log = logger.setContext("StaffCryptoService.getStaffPublicKey");

    try {
      const db = await getTenantDb(tenantId);
      const result = await db
        .select({
          publicKey: staffCrypto.publicKey,
        })
        .from(staffCrypto)
        .where(eq(staffCrypto.userId, userId))
        .limit(1);

      if (result.length === 0) {
        log.warn("Staff crypto not found", { tenantId, userId });
        return null;
      }

      const publicKey = result[0].publicKey;
      log.debug("Retrieved staff public key", {
        tenantId,
        userId,
        hasKey: !!publicKey,
      });

      return publicKey;
    } catch (error) {
      log.error("Failed to retrieve staff public key", {
        tenantId,
        userId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get complete staff crypto data (for key reconstruction)
   */
  async getStaffCryptoData(
    tenantId: string,
    userId: string,
  ): Promise<{
    publicKey: string;
    privateKeyShare: string;
    passkeyId: string;
  } | null> {
    const log = logger.setContext("StaffCryptoService.getStaffCryptoData");

    try {
      const db = await getTenantDb(tenantId);
      const result = await db
        .select({
          publicKey: staffCrypto.publicKey,
          privateKeyShare: staffCrypto.privateKeyShare,
          passkeyId: staffCrypto.passkeyId,
        })
        .from(staffCrypto)
        .where(eq(staffCrypto.userId, userId))
        .limit(1);

      if (result.length === 0) {
        log.warn("Staff crypto data not found", { tenantId, userId });
        return null;
      }

      const data = result[0];
      log.debug("Retrieved staff crypto data", {
        tenantId,
        userId,
        hasPublicKey: !!data.publicKey,
        hasPrivateKeyShare: !!data.privateKeyShare,
        passkeyId: data.passkeyId,
      });

      return {
        publicKey: data.publicKey,
        privateKeyShare: data.privateKeyShare,
        passkeyId: data.passkeyId,
      };
    } catch (error) {
      log.error("Failed to retrieve staff crypto data", {
        tenantId,
        userId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Derive a deterministic shard from passkey authentication data
   * This shard will be the same every time the user authenticates with the same passkey
   */
  private async derivePasskeyBasedShard(
    passkeyId: string,
    authenticatorData: ArrayBuffer,
  ): Promise<Uint8Array> {
    // Use HKDF to derive a deterministic shard from passkey data
    const salt = Buffer.from("staff-crypto-shard-v1", "utf-8");
    const info = Buffer.from(`passkey:${passkeyId}`, "utf-8");

    // Extract randomness from authenticator data
    const inputKeyMaterial = new Uint8Array(authenticatorData);

    // HKDF-Extract
    const prk = crypto.createHmac("sha256", salt).update(Buffer.from(inputKeyMaterial)).digest();

    // HKDF-Expand to get the needed length for Kyber private key (2400 bytes for ML-KEM-768)
    const keyLength = 2400; // ML-KEM-768 private key length
    const expandLength = Math.ceil(keyLength / 32); // SHA256 output length is 32 bytes
    const okm = new Uint8Array(keyLength);

    for (let i = 0; i < expandLength; i++) {
      const hmac = crypto.createHmac("sha256", prk);
      hmac.update(info);
      hmac.update(Buffer.from([i + 1]));
      const t = hmac.digest();

      const copyLength = Math.min(32, keyLength - i * 32);
      okm.set(t.subarray(0, copyLength), i * 32);
    }

    return okm;
  }

  /**
   * Generate a random shard for database storage
   */
  private generateRandomShard(length: number): Uint8Array {
    return crypto.randomBytes(length);
  }

  /**
   * Helper functions for encoding/decoding
   */
  private bufferToBase64(buffer: Uint8Array): string {
    return Buffer.from(buffer).toString("base64");
  }

  private base64ToBuffer(base64: string): Uint8Array {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
}
