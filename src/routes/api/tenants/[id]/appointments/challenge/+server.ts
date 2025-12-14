import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { getTenantDb } from "$lib/server/db";
import { clientAppointmentTunnel } from "$lib/server/db/tenant-schema";
import type { ChallengeResponse } from "$lib/types/appointment";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { KyberCrypto, BufferUtils } from "$lib/crypto/utils";
import { challengeStore } from "$lib/server/services/challenge-store";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { challengeThrottleService } from "$lib/server/services/challenge-throttle";

const requestSchema = z.object({
  emailHash: z.string(),
});

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/appointments/challenge", "POST", {
  summary: "Create authentication challenge",
  description:
    "Creates a cryptographic challenge for client authentication. Used to verify client identity before accessing appointments.",
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
    description: "Challenge request data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            emailHash: {
              type: "string",
              description: "SHA-256 hash of client email address",
              example: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
            },
          },
          required: ["emailHash"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Challenge created successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              challengeId: {
                type: "string",
                description: "Unique identifier for this challenge",
                example: "a1b2c3d4e5f6789012345678",
              },
              encryptedChallenge: {
                type: "string",
                description: "Challenge encrypted with client's public key (hex encoded)",
                example: "deadbeef123456789abcdef...",
              },
              privateKeyShare: {
                type: "string",
                description: "Server-stored share of client's private key",
                example: "fedcba9876543210fedcba98...",
              },
            },
            required: ["challengeId", "encryptedChallenge", "privateKeyShare"],
          },
        },
      },
    },
    "400": {
      description: "Invalid request data",
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
    "429": {
      description: "Too many failed attempts - rate limited",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string", description: "Error message" },
              retryAfterMs: {
                type: "number",
                description: "Milliseconds to wait before retrying",
              },
            },
          },
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
 * POST /api/tenants/[id]/appointments/challenge
 *
 * Creates a challenge for an existing client to verify their identity.
 * Returns encrypted challenge and private key share for client authentication.
 */
export const POST: RequestHandler = async ({ request, params }) => {
  try {
    const tenantId = params.id;
    if (!tenantId) {
      return json({ error: "Tenant ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const { emailHash } = requestSchema.parse(body);

    // Check throttling
    const throttleResult = await challengeThrottleService.checkThrottle(
      emailHash,
      "pin",
      tenantId,
    );

    if (!throttleResult.allowed) {
      logger.warn("PIN challenge throttled", {
        tenantId,
        emailHashPrefix: emailHash.slice(0, 8),
        retryAfterMs: throttleResult.retryAfterMs,
        failedAttempts: throttleResult.failedAttempts,
      });

      return json(
        {
          error: "Too many failed attempts. Please try again later.",
          retryAfterMs: throttleResult.retryAfterMs,
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(throttleResult.retryAfterMs / 1000).toString(),
          },
        },
      );
    }

    logger.info("Creating challenge for existing client", {
      tenantId,
      emailHashPrefix: emailHash.slice(0, 8),
    });

    const db = await getTenantDb(tenantId);

    // Retrieve client tunnel
    const tunnelResult = await db
      .select({
        id: clientAppointmentTunnel.id,
        clientPublicKey: clientAppointmentTunnel.clientPublicKey,
        privateKeyShare: clientAppointmentTunnel.privateKeyShare,
      })
      .from(clientAppointmentTunnel)
      .where(eq(clientAppointmentTunnel.emailHash, emailHash))
      .limit(1);

    if (tunnelResult.length === 0) {
      logger.warn("Client tunnel not found for challenge", {
        tenantId,
        emailHashPrefix: emailHash.slice(0, 8),
      });
      return json({ error: "Client not found" }, { status: 404 });
    }

    const tunnel = tunnelResult[0];

    // Generate random challenge and unique challenge ID
    const challenge = randomBytes(32).toString("base64");
    const challengeId = randomBytes(16).toString("hex");

    // Store challenge in database for verification
    await challengeStore.store(challengeId, challenge, emailHash, tenantId);

    // Encrypt challenge with Client's ML-KEM-768 Public Key
    const clientPublicKeyBuffer = BufferUtils.from(tunnel.clientPublicKey, "hex");
    const encapsulation = KyberCrypto.encapsulate(clientPublicKeyBuffer);

    // Use the shared secret to encrypt the challenge (decode base64 first!)
    const challengeBuffer = Buffer.from(challenge, "base64");
    const encryptedChallengeBuffer = BufferUtils.xor(
      challengeBuffer,
      encapsulation.sharedSecret.slice(0, challengeBuffer.length),
    );

    // Combine encapsulated secret + encrypted challenge
    const fullEncryptedChallenge = BufferUtils.concat([
      encapsulation.encapsulatedSecret,
      encryptedChallengeBuffer,
    ]);

    const encryptedChallenge = BufferUtils.toString(fullEncryptedChallenge, "hex");

    const response: ChallengeResponse = {
      challengeId, // ID to reference this challenge during verification
      encryptedChallenge,
      privateKeyShare: tunnel.privateKeyShare,
    };

    logger.info("Successfully created challenge", {
      tenantId,
      tunnelId: tunnel.id,
      challengeLength: challenge.length,
    });

    return json(response);
  } catch (error) {
    logError(logger)("Failed to create challenge", error);

    if (error instanceof z.ZodError) {
      return new ValidationError("Invalid request data").toJson();
    }
    if (error instanceof BackendError) {
      return error.toJson();
    }
    return new InternalError().toJson();
  }
};
