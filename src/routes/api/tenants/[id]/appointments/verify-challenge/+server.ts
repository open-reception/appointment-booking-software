import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { getTenantDb } from "$lib/server/db";
import { clientAppointmentTunnel } from "$lib/server/db/tenant-schema";
import type { ChallengeVerificationResponse } from "$lib/types/appointment";
import { eq } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
import { challengeStore } from "$lib/server/services/challenge-store";
import {
  BackendError,
  InternalError,
  logError,
  NotFoundError,
  ValidationError,
} from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";

const requestSchema = z.object({
  challengeId: z.string(),
  challengeResponse: z.string(),
});

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/appointments/verify-challenge", "POST", {
  summary: "Verify authentication challenge",
  description:
    "Verifies a client's response to a cryptographic challenge and returns access credentials for appointment data.",
  tags: ["Appointments", "Authentication"],
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
    description: "Challenge verification data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            challengeId: {
              type: "string",
              description: "Challenge ID received from challenge creation",
              example: "a1b2c3d4e5f6789012345678",
            },
            challengeResponse: {
              type: "string",
              description: "Decrypted challenge response (base64 encoded)",
              example: "SGVsbG8gV29ybGQ=",
            },
          },
          required: ["challengeId", "challengeResponse"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Challenge verified successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              valid: {
                type: "boolean",
                description: "Whether the challenge verification was successful",
                example: true,
              },
              encryptedTunnelKey: {
                type: "string",
                description: "Tunnel key encrypted with client's public key",
                example: "deadbeef123456789abcdef...",
              },
              tunnelId: {
                type: "string",
                format: "uuid",
                description: "Client tunnel identifier for accessing appointments",
                example: "550e8400-e29b-41d4-a716-446655440000",
              },
            },
            required: ["valid", "encryptedTunnelKey", "tunnelId"],
          },
        },
      },
    },
    "400": {
      description: "Invalid request data or challenge response",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Challenge not found or expired",
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
 * POST /api/tenants/[id]/appointments/verify-challenge
 *
 * Verifies the challenge response of an existing client and
 * returns an auth token and required keys on success.
 */
export const POST: RequestHandler = async ({ request, params }) => {
  try {
    const tenantId = params.id;
    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }

    const body = await request.json();
    const { challengeId, challengeResponse } = requestSchema.parse(body);

    logger.info("Verifying challenge for existing client", {
      tenantId,
      challengeId,
    });

    // Retrieve and consume the stored challenge
    const storedChallenge = await challengeStore.consume(challengeId, tenantId);
    if (!storedChallenge) {
      logger.warn("Challenge not found or expired", {
        tenantId,
        challengeId,
      });
      throw new NotFoundError("Challenge not found or expired");
    }

    // Validate challenge response using constant-time comparison
    const expectedChallenge = storedChallenge.challenge;
    const challengeBuffer = Buffer.from(challengeResponse, "base64");
    const expectedBuffer = Buffer.from(expectedChallenge, "base64");

    if (
      challengeBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(challengeBuffer, expectedBuffer)
    ) {
      logger.warn("Challenge response mismatch", {
        tenantId,
        challengeId,
        emailHashPrefix: storedChallenge.emailHash.slice(0, 8),
      });
      throw new ValidationError("Invalid challenge response");
    }

    const db = await getTenantDb(tenantId);

    // Retrieve client tunnel using the emailHash from stored challenge
    const tunnelResult = await db
      .select({
        id: clientAppointmentTunnel.id,
        clientEncryptedTunnelKey: clientAppointmentTunnel.clientEncryptedTunnelKey,
      })
      .from(clientAppointmentTunnel)
      .where(eq(clientAppointmentTunnel.emailHash, storedChallenge.emailHash))
      .limit(1);

    if (tunnelResult.length === 0) {
      logger.warn("Client tunnel not found for verification", {
        tenantId,
        challengeId,
        emailHashPrefix: storedChallenge.emailHash.slice(0, 8),
      });
      throw new NotFoundError("Client not found");
    }

    const tunnel = tunnelResult[0];

    logger.info("Challenge response validated successfully", {
      tenantId,
      challengeId,
      tunnelId: tunnel.id,
    });

    const response: ChallengeVerificationResponse = {
      valid: true,
      encryptedTunnelKey: tunnel.clientEncryptedTunnelKey,
      tunnelId: tunnel.id,
    };

    logger.info("Successfully verified challenge", {
      tenantId,
      tunnelId: tunnel.id,
    });

    return json(response);
  } catch (error) {
    logError(logger)("Failed to verify challenge", error);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    if (error instanceof z.ZodError) {
      return new ValidationError("Invalid request data").toJson();
    }

    return new InternalError().toJson();
  }
};
