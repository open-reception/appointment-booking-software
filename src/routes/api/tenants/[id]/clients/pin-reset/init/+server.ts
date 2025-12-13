import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { UniversalLogger } from "$lib/logger";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import { ClientPinResetService } from "$lib/server/services/client-pin-reset-service";
import { registerOpenAPIRoute } from "$lib/server/openapi";

const logger = new UniversalLogger().setContext("ClientPinResetInitAPI");

const initPinResetSchema = z.object({
  emailHash: z.string().min(64).max(64), // SHA-256 hash is 64 hex characters
});

registerOpenAPIRoute("/tenants/{id}/clients/pin-reset/init", "POST", {
  summary: "Initialize PIN reset (QR code for in-person)",
  description:
    "Creates a PIN reset token for a client who forgot their PIN. This endpoint is designed for in-person use at the practice, where staff generates a QR code containing the reset token. The client scans this QR code and can immediately set a new PIN. Requires administrative permissions (TENANT_ADMIN or STAFF).",
  tags: ["Clients", "PIN Reset"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
  ],
  requestBody: {
    description: "Client email hash to initiate PIN reset",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            emailHash: {
              type: "string",
              description: "SHA-256 hash of the client's email address (64 hex characters)",
              example: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
            },
          },
          required: ["emailHash"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "PIN reset token created successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                format: "uuid",
                description: "Reset token to be included in QR code",
              },
              expiresAt: {
                type: "string",
                format: "date-time",
                description: "Token expiration timestamp (ISO 8601)",
              },
              expirationMinutes: {
                type: "number",
                description: "Minutes until token expires",
                example: 30,
              },
            },
            required: ["token", "expiresAt", "expirationMinutes"],
          },
        },
      },
    },
    "400": {
      description: "Invalid input data",
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
      description: "Administrative permissions required",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Client not found",
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

/**
 * POST /api/tenants/[id]/clients/pin-reset/init
 *
 * Initialize PIN reset with QR code (in-person at practice)
 * - Validates that the user has administrative permissions
 * - Creates a short-lived reset token (30 minutes)
 * - Returns token for QR code generation
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const tenantId = params.id!;

  try {
    logger.debug("PIN reset init request received", { tenantId, userId: locals.user?.id });

    // Check permissions - only admins and staff can initiate PIN reset
    await checkPermission(locals, tenantId);

    // Parse and validate request body
    const body = await request.json();
    const validatedData = initPinResetSchema.parse(body);

    logger.debug("Request validated", { emailHash: validatedData.emailHash.slice(0, 8) });

    // Create PIN reset service
    const pinResetService = await ClientPinResetService.forTenant(tenantId);

    // Create reset token (expires in 30 minutes for in-person use)
    const expirationMinutes = 30;
    const token = await pinResetService.createResetToken(
      validatedData.emailHash,
      expirationMinutes,
    );

    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

    logger.info("PIN reset token created for QR code", {
      tenantId,
      emailHash: validatedData.emailHash.slice(0, 8),
      tokenId: token.slice(0, 8),
      initiatedBy: locals.user?.id,
    });

    return json({
      token,
      expiresAt: expiresAt.toISOString(),
      expirationMinutes,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Validation error in PIN reset init", { error: error });
      return json({ error: "Invalid request data", details: error }, { status: 400 });
    }

    if (error instanceof NotFoundError) {
      logger.warn("Client not found for PIN reset", { tenantId });
      return json({ error: error.message }, { status: 404 });
    }

    if (error instanceof ValidationError) {
      logger.warn("Validation error in PIN reset init", { error: error.message });
      return json({ error: error.message }, { status: 400 });
    }

    logger.error("Unexpected error in PIN reset init", { error: String(error), tenantId });
    return json({ error: "Internal server error" }, { status: 500 });
  }
};
