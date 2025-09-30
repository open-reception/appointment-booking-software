/**
 * API Route: Get Staff Public Key
 *
 * Returns the public key of a specific staff member.
 * Used by other staff members to encrypt data for the target staff member.
 * Requires the requesting user to be authenticated and belong to the same tenant.
 */

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { logger } from "$lib/logger";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { centralDb } from "$lib/server/db";
import { user } from "$lib/server/db/central-schema";
import { eq } from "drizzle-orm";
import { registerOpenAPIRoute } from "$lib/server/openapi";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/staff/{staffId}/public-key", "GET", {
  summary: "Get staff member's public key",
  description:
    "Returns the public key of a specific staff member. Used by other staff members to encrypt data for the target staff member. Requires authentication and tenant membership.",
  tags: ["Staff", "Encryption"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "staffId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Staff member's user ID",
    },
  ],
  responses: {
    "200": {
      description: "Staff public key retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              userId: { type: "string", format: "uuid", description: "Staff member's user ID" },
              publicKey: { type: "string", description: "Base64-encoded ML-KEM-768 public key" },
            },
            required: ["userId", "publicKey"],
          },
        },
      },
    },
    "400": {
      description: "Invalid input data or staff user not found/inactive",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "401": {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "403": {
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Staff user or public key not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "500": {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
  },
});

export const GET: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API.StaffPublicKey");
  const tenantId = params.id;
  const staffId = params.staffId;

  if (!tenantId || !staffId) {
    throw new ValidationError("Tenant ID and Staff ID are required");
  }

  // Berechtigungsprüfung - Benutzer muss eingeloggt sein und zum Tenant gehören
  checkPermission(locals, tenantId, false);

  try {
    log.debug("Fetching staff public key", { tenantId, staffId, requesterId: locals.user?.userId });

    // Prüfen, ob der angeforderte Staff-Benutzer zum Tenant gehört
    const staffUser = await centralDb
      .select({
        id: user.id,
        tenantId: user.tenantId,
        isActive: user.isActive,
      })
      .from(user)
      .where(eq(user.id, staffId))
      .limit(1);

    if (staffUser.length === 0) {
      log.warn("Staff user not found", { tenantId, staffId });
      throw new ValidationError("Staff user not found");
    }

    if (staffUser[0].tenantId !== tenantId) {
      log.warn("Staff user does not belong to tenant", {
        tenantId,
        staffId,
        staffTenantId: staffUser[0].tenantId,
      });
      throw new ValidationError("Staff user does not belong to this tenant");
    }

    if (!staffUser[0].isActive) {
      log.warn("Staff user is inactive", { tenantId, staffId });
      throw new ValidationError("Staff user is inactive");
    }

    const staffCryptoService = new StaffCryptoService();
    const publicKey = await staffCryptoService.getStaffPublicKey(tenantId, staffId);

    if (!publicKey) {
      log.warn("Staff public key not found", { tenantId, staffId });
      throw new ValidationError("Staff public key not found");
    }

    log.debug("Staff public key retrieved successfully", {
      tenantId,
      staffId,
      requesterId: locals.user?.userId,
      hasPublicKey: !!publicKey,
    });

    return json({
      userId: staffId,
      publicKey: publicKey,
    });
  } catch (error) {
    logError(log)("Error fetching staff public key", error, locals.user?.userId, tenantId);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
