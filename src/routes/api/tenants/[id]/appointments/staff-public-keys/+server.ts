import { json, type RequestHandler } from "@sveltejs/kit";
import { logger } from "$lib/logger";
import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import {
  AuthenticationError,
  AuthorizationError,
  BackendError,
  InternalError,
  logError,
  ValidationError,
} from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { verifyBookingAccessToken } from "$lib/server/auth/booking-access-token";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/appointments/staff-public-keys", "GET", {
  summary: "Get staff public keys",
  description:
    "Returns public encryption keys for all staff members. Requires a valid short-lived booking access token from /appointments/verify-challenge.",
  tags: ["Appointments", "Encryption"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "Authorization",
      in: "header",
      required: true,
      schema: { type: "string" },
      description: "Bearer booking access token from /appointments/verify-challenge",
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
    "401": {
      description: "Missing or invalid booking access token",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "403": {
      description: "Booking access token does not match requested tenant",
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
 * Requires booking access token from verify-challenge endpoint.
 */
export const GET: RequestHandler = async ({ params, request }) => {
  try {
    const tenantId = params.id;
    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }

    const authorizationHeader = request.headers.get("Authorization");
    if (!authorizationHeader?.startsWith("Bearer ")) {
      throw new AuthenticationError("Booking access token is required");
    }

    const token = authorizationHeader.substring("Bearer ".length).trim();
    if (!token) {
      throw new AuthenticationError("Booking access token is required");
    }

    const tokenPayload = await verifyBookingAccessToken(token);
    if (!tokenPayload) {
      throw new AuthenticationError("Invalid or expired booking access token");
    }

    if (tokenPayload.tenantId !== tenantId) {
      throw new AuthorizationError("Booking access token is not valid for this tenant");
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
