import { getTenantDb } from "../db";
import * as tenantSchema from "../db/tenant-schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, lt } from "drizzle-orm";
import { UniversalLogger } from "$lib/logger";
import { NotFoundError, ValidationError } from "../utils/errors";
import { addMinutes } from "date-fns";

const logger = new UniversalLogger();
const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * ClientPinResetService
 *
 * Handles PIN reset functionality for clients who have forgotten their PIN.
 * Supports two reset methods:
 * 1. QR Code based (in-person at practice)
 * 2. Email link based (remote)
 *
 * Both methods involve:
 * - Generating a secure reset token
 * - Rotating the client's keypair
 * - Re-encrypting the tunnel key with the new keypair
 */
export class ClientPinResetService {
  #db: PostgresJsDatabase<typeof tenantSchema> | null = null;

  private constructor(public readonly tenantId: string) {}

  /**
   * Create a ClientPinResetService for a specific tenant
   * @param tenantId The ID of the tenant
   * @returns new ClientPinResetService instance
   */
  static async forTenant(tenantId: string): Promise<ClientPinResetService> {
    const log = logger.setContext("ClientPinResetService");
    log.debug("Creating client PIN reset service for tenant", { tenantId });

    try {
      const service = new ClientPinResetService(tenantId);
      service.#db = await getTenantDb(tenantId);

      log.debug("Client PIN reset service created successfully", { tenantId });
      return service;
    } catch (error) {
      log.error("Failed to create client PIN reset service", { tenantId, error: String(error) });
      throw error;
    }
  }

  /**
   * Create a PIN reset token for a client
   * Token expires after 30 minutes by default
   *
   * @param emailHash SHA-256 hash of the client's email
   * @param expirationMinutes How many minutes until the token expires (default: 30)
   * @returns The reset token (UUID)
   */
  async createResetToken(emailHash: string, expirationMinutes: number = 30): Promise<string> {
    const log = logger.setContext("ClientPinResetService");
    const db = await this.getDb();

    log.debug("Creating PIN reset token", {
      emailHash: emailHash.slice(0, 8),
      tenantId: this.tenantId,
    });

    try {
      // Check if client tunnel exists
      const tunnel = await db
        .select({ id: tenantSchema.clientAppointmentTunnel.id })
        .from(tenantSchema.clientAppointmentTunnel)
        .where(eq(tenantSchema.clientAppointmentTunnel.emailHash, emailHash))
        .limit(1);

      if (tunnel.length === 0) {
        log.warn("No client tunnel found for email hash", { emailHash: emailHash.slice(0, 8) });
        throw new NotFoundError("Client not found");
      }

      // Create reset token with expiration
      const expiresAt = addMinutes(new Date(), expirationMinutes);
      const [resetToken] = await db
        .insert(tenantSchema.clientPinResetToken)
        .values({
          emailHash,
          expiresAt,
          used: false,
        })
        .returning({ token: tenantSchema.clientPinResetToken.token });

      log.info("PIN reset token created", {
        emailHash: emailHash.slice(0, 8),
        tokenId: resetToken.token.slice(0, 8),
        expiresAt,
      });

      return resetToken.token;
    } catch (error) {
      log.error("Failed to create PIN reset token", {
        emailHash: emailHash.slice(0, 8),
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Verify a PIN reset token
   * Checks if token is valid, not expired, and not already used
   *
   * @param token The reset token to verify
   * @returns The email hash associated with this token
   * @throws NotFoundError if token is invalid
   * @throws ValidationError if token is expired or already used
   */
  async verifyResetToken(token: string): Promise<string> {
    const log = logger.setContext("ClientPinResetService");
    const db = await this.getDb();

    log.debug("Verifying PIN reset token", { tokenId: token.slice(0, 8) });

    try {
      // Find the token
      const [resetToken] = await db
        .select()
        .from(tenantSchema.clientPinResetToken)
        .where(eq(tenantSchema.clientPinResetToken.token, token))
        .limit(1);

      if (!resetToken) {
        log.warn("Invalid PIN reset token", { tokenId: token.slice(0, 8) });
        throw new NotFoundError("Invalid reset token");
      }

      // Check if token is already used
      if (resetToken.used) {
        log.warn("PIN reset token already used", { tokenId: token.slice(0, 8) });
        throw new ValidationError("Reset token has already been used");
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        log.warn("PIN reset token expired", {
          tokenId: token.slice(0, 8),
          expiresAt: resetToken.expiresAt,
        });
        throw new ValidationError("Reset token has expired");
      }

      log.debug("PIN reset token verified successfully", {
        tokenId: token.slice(0, 8),
        emailHash: resetToken.emailHash.slice(0, 8),
      });

      return resetToken.emailHash;
    } catch (error) {
      log.error("Failed to verify PIN reset token", {
        tokenId: token.slice(0, 8),
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Complete the PIN reset process
   * This involves:
   * 1. Verifying the reset token
   * 2. Updating the client's keypair (from frontend)
   * 3. Re-encrypting the tunnel key with new client keypair (from frontend)
   * 4. Marking the token as used
   *
   * Note: Staff key shares remain unchanged because the tunnel key itself doesn't change,
   * only the client's keypair is rotated.
   *
   * @param token The reset token
   * @param newClientPublicKey Base64 encoded new client public key (ML-KEM-768)
   * @param newPrivateKeyShare Base64 encoded new private key share (derived from new PIN)
   * @param newClientEncryptedTunnelKey Hex encoded tunnel key encrypted with new client public key
   * @returns The tunnel ID
   */
  async completePinReset(
    token: string,
    newClientPublicKey: string,
    newPrivateKeyShare: string,
    newClientEncryptedTunnelKey: string,
  ): Promise<string> {
    const log = logger.setContext("ClientPinResetService");
    const db = await this.getDb();

    log.debug("Completing PIN reset", { tokenId: token.slice(0, 8) });

    try {
      // 1. Verify the token and get email hash
      const emailHash = await this.verifyResetToken(token);

      // 2. Get the client tunnel
      const [tunnel] = await db
        .select()
        .from(tenantSchema.clientAppointmentTunnel)
        .where(eq(tenantSchema.clientAppointmentTunnel.emailHash, emailHash))
        .limit(1);

      if (!tunnel) {
        throw new NotFoundError("Client tunnel not found");
      }

      // 3. Update the client tunnel with new keys
      await db
        .update(tenantSchema.clientAppointmentTunnel)
        .set({
          clientPublicKey: newClientPublicKey,
          privateKeyShare: newPrivateKeyShare,
          clientEncryptedTunnelKey: newClientEncryptedTunnelKey,
          updatedAt: new Date(),
        })
        .where(eq(tenantSchema.clientAppointmentTunnel.id, tunnel.id));

      log.info("Client tunnel keys updated", { tunnelId: tunnel.id });

      // 4. Mark the token as used
      await db
        .update(tenantSchema.clientPinResetToken)
        .set({ used: true })
        .where(eq(tenantSchema.clientPinResetToken.token, token));

      log.info("PIN reset completed successfully", {
        tokenId: token.slice(0, 8),
        tunnelId: tunnel.id,
        emailHash: emailHash.slice(0, 8),
      });

      return tunnel.id;
    } catch (error) {
      log.error("Failed to complete PIN reset", {
        tokenId: token.slice(0, 8),
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Clean up expired and used reset tokens (housekeeping)
   * Should be called periodically (e.g., daily cron job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const log = logger.setContext("ClientPinResetService");
    const db = await this.getDb();

    log.debug("Cleaning up expired PIN reset tokens");

    try {
      const result = await db.delete(tenantSchema.clientPinResetToken).where(
        lt(tenantSchema.clientPinResetToken.createdAt, new Date(Date.now() - SEVEN_DAYS_IN_MS)), // older than 7 days
      );

      log.info("Expired PIN reset tokens cleaned up", { count: result.count });

      return result.count || 0;
    } catch (error) {
      log.error("Failed to cleanup expired tokens", { error: String(error) });
      throw error;
    }
  }

  /**
   * Get the tenant's database connection (cached)
   */
  private async getDb(): Promise<PostgresJsDatabase<typeof tenantSchema>> {
    if (!this.#db) {
      this.#db = await getTenantDb(this.tenantId);
    }
    return this.#db;
  }
}
