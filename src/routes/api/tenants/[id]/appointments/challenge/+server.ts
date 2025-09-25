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

const requestSchema = z.object({
  emailHash: z.string(),
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

    // Use the shared secret to encrypt the challenge
    const challengeBuffer = BufferUtils.from(challenge);
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
