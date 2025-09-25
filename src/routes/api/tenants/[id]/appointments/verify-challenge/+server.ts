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

const requestSchema = z.object({
  challengeId: z.string(),
  challengeResponse: z.string(),
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
