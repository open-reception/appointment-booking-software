/**
 * API Route: Get Staff Key Shard
 *
 * Returns the database-stored shard of a staff member's private key for key reconstruction.
 * This is used by the crypto worker to reconstruct the full private key from the two shards.
 */

import { json } from "@sveltejs/kit";
import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { logger } from "$lib/logger";

export const GET = async ({ params }: { params: { id: string; staffId: string } }) => {
  const log = logger.setContext("API.StaffKeyShard");
  const { id: tenantId, staffId } = params;

  if (!tenantId || !staffId) {
    return json({ error: "Tenant ID and Staff ID are required" }, { status: 400 });
  }

  try {
    log.debug("Fetching staff key shard", { tenantId, staffId });

    const staffCryptoService = new StaffCryptoService();

    // Get the staff crypto data (contains both public key and private key shard)
    const staffCrypto = await staffCryptoService.getStaffCryptoData(tenantId, staffId);

    if (!staffCrypto) {
      log.warn("Staff crypto data not found", { tenantId, staffId });
      return json({ error: "Staff crypto data not found" }, { status: 404 });
    }

    log.debug("Staff key shard retrieved successfully", {
      tenantId,
      staffId,
      hasPublicKey: !!staffCrypto.publicKey,
      hasPrivateKeyShare: !!staffCrypto.privateKeyShare,
      passkeyId: staffCrypto.passkeyId,
    });

    return json({
      publicKey: staffCrypto.publicKey,
      privateKeyShare: staffCrypto.privateKeyShare,
      passkeyId: staffCrypto.passkeyId,
    });
  } catch (error) {
    log.error("Failed to fetch staff key shard", {
      tenantId,
      staffId,
      error: String(error),
    });

    return json({ error: "Internal server error" }, { status: 500 });
  }
};
