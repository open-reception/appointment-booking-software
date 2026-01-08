import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { UniversalLogger } from "$lib/logger";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import { ClientPinResetService } from "$lib/server/services/client-pin-reset-service";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { env } from "$env/dynamic/private";

const logger = new UniversalLogger().setContext("ClientPinResetRequestAPI");

const requestPinResetSchema = z.object({
  emailHash: z.string().min(64).max(64), // SHA-256 hash is 64 hex characters
  clientLanguage: z.enum(["de", "en"]).optional().default("de"),
});

registerOpenAPIRoute("/tenants/{id}/clients/pin-reset/request", "POST", {
  summary: "Request PIN reset via email",
  description:
    "Creates a PIN reset token for a client who forgot their PIN and sends an email with a reset link. This endpoint is designed for remote PIN reset. The client receives an email containing a secure link with the reset token. The token is valid for 60 minutes. Requires administrative permissions (TENANT_ADMIN or STAFF).",
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
    description: "Client email hash and language preference to request PIN reset",
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
            clientLanguage: {
              type: "string",
              enum: ["de", "en"],
              description: "Client's preferred language for the email",
              default: "de",
            },
          },
          required: ["emailHash"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "PIN reset email sent successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "Success message",
                example: "PIN reset email sent successfully",
              },
              emailHash: {
                type: "string",
                description: "Hash of the email address (first 8 characters for logging)",
              },
              resetUrl: {
                type: "string",
                description:
                  "The URL included in the email that the client can use to reset their PIN",
              },
            },
            required: ["message", "emailHash", "resetUrl"],
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
      description: "Client or tenant not found",
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
 * POST /api/tenants/[id]/clients/pin-reset/request
 *
 * Request PIN reset via email link
 * - Validates that the user has administrative permissions
 * - Creates a reset token (60 minutes expiration)
 * - Sends email with reset link to client
 *
 * NOTE: This endpoint does NOT send an actual email yet, as we don't store
 * the client's email address. The email would need to be provided separately
 * or the practice needs to manually send the link to the client.
 * For now, this returns the token that can be used to construct a reset URL.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const tenantId = params.id!;

  try {
    logger.debug("PIN reset request received", { tenantId, userId: locals.user?.id });

    // Check permissions - only admins and staff can request PIN reset
    await checkPermission(locals, tenantId);

    // Parse and validate request body
    const body = await request.json();
    const validatedData = requestPinResetSchema.parse(body);

    logger.debug("Request validated", { emailHash: validatedData.emailHash.slice(0, 8) });

    // Create PIN reset service
    const pinResetService = await ClientPinResetService.forTenant(tenantId);

    // Create reset token (expires in 60 minutes for email-based reset)
    const expirationMinutes = 60;
    const token = await pinResetService.createResetToken(
      validatedData.emailHash,
      expirationMinutes,
    );

    // Construct reset URL
    const baseUrl = env.PUBLIC_APP_URL || "http://localhost:5173";
    const resetUrl = `${baseUrl}/reset-pin/${token}`;

    logger.info("PIN reset token created for email", {
      tenantId,
      emailHash: validatedData.emailHash.slice(0, 8),
      tokenId: token.slice(0, 8),
      initiatedBy: locals.user?.id,
      resetUrl,
    });

    // TODO: Send actual email once we have a way to get the client's email
    // For now, we just return success and log the URL
    // In a real implementation, you would:
    // 1. Look up the client's email from somewhere (maybe pass it in the request)
    // 2. Use sendClientPinResetEmail(clientEmail, tenant, resetUrl, validatedData.clientLanguage)

    logger.warn("PIN reset email not sent - email address not available", {
      emailHash: validatedData.emailHash.slice(0, 8),
      resetUrl,
    });

    return json({
      message: "PIN reset token created - provide reset URL to client",
      emailHash: validatedData.emailHash.slice(0, 8),
      resetUrl, // Return URL so staff can manually send it to client
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Validation error in PIN reset request", { error: error });
      return json({ error: "Invalid request data", details: error }, { status: 400 });
    }

    if (error instanceof NotFoundError) {
      logger.warn("Client or tenant not found for PIN reset", { tenantId });
      return json({ error: error.message }, { status: 404 });
    }

    if (error instanceof ValidationError) {
      logger.warn("Validation error in PIN reset request", { error: error.message });
      return json({ error: error.message }, { status: 400 });
    }

    logger.error("Unexpected error in PIN reset request", { error: String(error), tenantId });
    return json({ error: "Internal server error" }, { status: 500 });
  }
};
