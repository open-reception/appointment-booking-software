import { json, type RequestHandler } from "@sveltejs/kit";
import { logger } from "$lib/logger";
import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";

/**
 * GET /api/tenants/[id]/appointments/staff-public-keys
 *
 * Returns the public keys of all staff members for encryption.
 * This is a public endpoint used by clients to encrypt appointment data.
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const tenantId = params.id;
    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }

    logger.info("Fetching staff public keys", { tenantId });

    // Get staff public keys for encryption
    const staffCryptoService = new StaffCryptoService();
    const staffPublicKeys = await staffCryptoService.getStaffPublicKeys(tenantId);

    if (staffPublicKeys.length === 0) {
      logger.warn("No staff public keys found for tenant", { tenantId });
      throw new InternalError("No staff members with encryption keys found");
    }

    logger.info("Successfully retrieved staff public keys", {
      tenantId,
      staffCount: staffPublicKeys.length,
    });

    return json({ staffPublicKeys });
  } catch (error) {
    logError(logger)("Failed to fetch staff public keys", error);
    if (error instanceof BackendError) {
      return error.toJson();
    }
    return new InternalError().toJson();
  }
};
