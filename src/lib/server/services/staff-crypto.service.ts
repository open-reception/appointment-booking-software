/**
 * Staff Crypto Service
 *
 * Manages cryptographic keys for staff members with browser-based split-key architecture:
 *
 * ## Architecture Overview:
 * - **Kyber Key Generation**: Happens entirely in the browser using KyberCrypto.generateKeyPair()
 * - **Split-Key Storage**: Private keys are split into two shards using XOR:
 *   - Passkey-based shard: Derived in browser from WebAuthn authenticatorData
 *   - Database shard: Stored encrypted in tenant database
 * - **Public Keys**: Stored in tenant database for client-side encryption
 *
 * ## Browser Integration Workflow:
 *
 * ### 1. Staff Passkey Registration (in browser):
 * ```javascript
 * // Generate Kyber keypair in browser
 * const keyPair = KyberCrypto.generateKeyPair();
 *
 * // Derive passkey-based shard from WebAuthn
 * const passkeyBasedShard = await derivePasskeyBasedShard(passkeyId, authenticatorData);
 *
 * // Create database shard using XOR
 * const dbShard = new Uint8Array(keyPair.privateKey.length);
 * for (let i = 0; i < keyPair.privateKey.length; i++) {
 *   dbShard[i] = keyPair.privateKey[i] ^ passkeyBasedShard[i];
 * }
 *
 * // Store via API
 * await fetch(`/api/tenants/${tenantId}/staff/${userId}/crypto`, {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     passkeyId,
 *     publicKey: bufferToBase64(keyPair.publicKey),
 *     privateKeyShare: bufferToBase64(dbShard)
 *   })
 * });
 * ```
 *
 * ### 2. Staff Authentication & Key Reconstruction (in browser):
 * ```javascript
 * // Get database shard from API
 * const response = await fetch(`/api/tenants/${tenantId}/staff/${userId}/key-shard`);
 * const { publicKey, privateKeyShare, passkeyId } = await response.json();
 *
 * // Derive same passkey-based shard from WebAuthn
 * const passkeyBasedShard = await derivePasskeyBasedShard(passkeyId, authenticatorData);
 *
 * // Reconstruct private key using XOR
 * const dbShard = base64ToBuffer(privateKeyShare);
 * const privateKey = new Uint8Array(dbShard.length);
 * for (let i = 0; i < dbShard.length; i++) {
 *   privateKey[i] = dbShard[i] ^ passkeyBasedShard[i];
 * }
 * ```
 *
 * ## API Methods:
 * - `storeStaffKeypair()`: Store browser-generated keys (called after passkey registration)
 * - `getStaffCryptoForPasskey()`: Get specific passkey's crypto data for reconstruction
 * - `getAllStaffCryptoData()`: Get all crypto entries for a staff member (multiple passkeys)
 * - `deleteStaffCryptoForPasskey()`: Delete crypto data when passkey is removed
 * - `getStaffPublicKeys()`: Get all staff public keys for client-side encryption
 */

import { logger } from "$lib/logger";
import { getTenantDb } from "$lib/server/db";
import { staffCrypto } from "$lib/server/db/tenant-schema";
import { eq, and } from "drizzle-orm";

export class StaffCryptoService {
  /**
   * Store keypair for staff member (generated in browser)
   * Keys are already split - we just store the database shard and public key
   */
  async storeStaffKeypair(
    tenantId: string,
    userId: string,
    passkeyId: string,
    publicKey: string, // Base64 encoded public key from browser
    privateKeyShare: string, // Base64 encoded database shard from browser
  ): Promise<void> {
    const log = logger.setContext("StaffCryptoService.storeStaffKeypair");

    try {
      log.debug("Storing staff keypair", { tenantId, userId, passkeyId });

      // Store in database
      const db = await getTenantDb(tenantId);
      await db.insert(staffCrypto).values({
        userId,
        publicKey,
        privateKeyShare,
        passkeyId,
        isActive: true,
      });

      log.info("Staff keypair stored successfully", {
        tenantId,
        userId,
        passkeyId,
        hasPublicKey: !!publicKey,
        hasPrivateKeyShare: !!privateKeyShare,
      });
    } catch (error) {
      log.error("Failed to store staff keypair", {
        tenantId,
        userId,
        passkeyId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get crypto data for specific staff member and passkey combination
   */
  async getStaffCryptoForPasskey(
    tenantId: string,
    userId: string,
    passkeyId: string,
  ): Promise<{
    publicKey: string;
    privateKeyShare: string;
    passkeyId: string;
  } | null> {
    const log = logger.setContext("StaffCryptoService.getStaffCryptoForPasskey");

    try {
      log.debug("Getting staff crypto for passkey", { tenantId, userId, passkeyId });

      const db = await getTenantDb(tenantId);
      const result = await db
        .select({
          publicKey: staffCrypto.publicKey,
          privateKeyShare: staffCrypto.privateKeyShare,
          passkeyId: staffCrypto.passkeyId,
        })
        .from(staffCrypto)
        .where(and(eq(staffCrypto.userId, userId), eq(staffCrypto.passkeyId, passkeyId)))
        .limit(1);

      if (result.length === 0) {
        log.warn("Staff crypto not found for passkey", { tenantId, userId, passkeyId });
        return null;
      }

      const data = result[0];
      log.debug("Staff crypto retrieved for passkey", {
        tenantId,
        userId,
        passkeyId,
        hasPublicKey: !!data.publicKey,
        hasPrivateKeyShare: !!data.privateKeyShare,
      });

      return {
        publicKey: data.publicKey,
        privateKeyShare: data.privateKeyShare,
        passkeyId: data.passkeyId,
      };
    } catch (error) {
      log.error("Failed to get staff crypto for passkey", {
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
   * Get all crypto data entries for a staff member (multiple passkeys)
   */
  async getAllStaffCryptoData(
    tenantId: string,
    userId: string,
  ): Promise<
    Array<{
      publicKey: string;
      privateKeyShare: string;
      passkeyId: string;
    }>
  > {
    const log = logger.setContext("StaffCryptoService.getAllStaffCryptoData");

    try {
      const db = await getTenantDb(tenantId);
      const results = await db
        .select({
          publicKey: staffCrypto.publicKey,
          privateKeyShare: staffCrypto.privateKeyShare,
          passkeyId: staffCrypto.passkeyId,
        })
        .from(staffCrypto)
        .where(eq(staffCrypto.userId, userId));

      log.debug("Retrieved all staff crypto data", {
        tenantId,
        userId,
        entryCount: results.length,
      });

      return results.map((data) => ({
        publicKey: data.publicKey,
        privateKeyShare: data.privateKeyShare,
        passkeyId: data.passkeyId,
      }));
    } catch (error) {
      log.error("Failed to retrieve all staff crypto data", {
        tenantId,
        userId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Delete crypto data for a specific passkey
   */
  async deleteStaffCryptoForPasskey(
    tenantId: string,
    userId: string,
    passkeyId: string,
  ): Promise<boolean> {
    const log = logger.setContext("StaffCryptoService.deleteStaffCryptoForPasskey");

    try {
      log.debug("Deleting staff crypto for passkey", { tenantId, userId, passkeyId });

      const db = await getTenantDb(tenantId);
      const result = await db
        .delete(staffCrypto)
        .where(and(eq(staffCrypto.userId, userId), eq(staffCrypto.passkeyId, passkeyId)));

      const deleted = result.count > 0;
      log.info("Staff crypto deletion completed", {
        tenantId,
        userId,
        passkeyId,
        deleted,
      });

      return deleted;
    } catch (error) {
      log.error("Failed to delete staff crypto for passkey", {
        tenantId,
        userId,
        passkeyId,
        error: String(error),
      });
      throw error;
    }
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
