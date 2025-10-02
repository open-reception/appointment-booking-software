import { json, type RequestHandler } from "@sveltejs/kit";
import { logger } from "$lib/logger";
import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/appointments/staff-public-keys", "GET", {
  summary: "Get staff public keys",
  description:
    "Returns public encryption keys for all staff members. Used by clients to encrypt appointment data for staff access. This is a public endpoint that doesn't require authentication.",
  tags: ["Appointments", "Encryption"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
  ],
  responses: {
    "200": {
      description: "Staff public keys retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              staffPublicKeys: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    userId: {
                      type: "string",
                      format: "uuid",
                      description: "Staff member's user ID",
                    },
                    publicKey: {
                      type: "string",
                      description: "ML-KEM-768 public key (hex encoded)",
                      example: "deadbeef123456789abcdef...",
                    },
                  },
                  required: ["userId", "publicKey"],
                },
                description: "List of staff public keys for encryption",
              },
            },
            required: ["staffPublicKeys"],
          },
        },
      },
    },
    "400": {
      description: "Invalid tenant ID",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "500": {
      description: "Internal server error or no staff keys found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
  },
});

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
