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
import { StaffService } from "$lib/server/services/staff-service";
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

    const result = await StaffService.getStaffPublicKey(tenantId, staffId);

    log.debug("Staff public key retrieved successfully", {
      tenantId,
      staffId,
      requesterId: locals.user?.userId,
      hasPublicKey: !!result.publicKey,
    });

    return json(result);
  } catch (error) {
    logError(log)("Error fetching staff public key", error, locals.user?.userId, tenantId);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
