import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { challengeStore } from "$lib/server/services/challenge-store";
import { challengeThrottleService } from "$lib/server/services/challenge-throttle";
import {
  BackendError,
  InternalError,
  NotFoundError,
  ValidationError,
  logError,
} from "$lib/server/utils/errors";
import {
  createBootstrapBinding,
  createBootstrapPowDigest,
  matchesPowDifficulty,
  NEW_CLIENT_BOOTSTRAP_DIFFICULTY,
} from "$lib/server/services/bootstrap-challenge";
import { generateNewClientBootstrapToken } from "$lib/server/auth/booking-access-token";
import type { BootstrapVerifyResponse } from "$lib/types/appointment";

const requestSchema = z.object({
  challengeId: z.string().min(1),
  tunnelId: z.string().uuid(),
  clientPublicKey: z.string().min(1),
  counter: z.number().int().min(0),
  emailHash: z.string().optional(),
});

registerOpenAPIRoute("/tenants/{id}/appointments/bootstrap-verify", "POST", {
  summary: "Verify bootstrap challenge for new client",
  description:
    "Verifies the nonce-based proof-of-work challenge for a new client and returns a short-lived bootstrap token.",
  tags: ["Appointments", "Clients"],
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
    description: "Bootstrap verification data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            challengeId: { type: "string" },
            tunnelId: { type: "string", format: "uuid" },
            clientPublicKey: { type: "string" },
            counter: { type: "integer" },
            emailHash: { type: "string" },
          },
          required: ["challengeId", "tunnelId", "clientPublicKey", "counter"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Bootstrap challenge verified successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              valid: { type: "boolean" },
              bookingAccessToken: { type: "string" },
            },
            required: ["valid", "bookingAccessToken"],
          },
        },
      },
    },
    "404": {
      description: "Bootstrap challenge not found or expired",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "422": {
      description: "Invalid request data or proof of work",
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

export const POST: RequestHandler = async ({ request, params }) => {
  try {
    const tenantId = params.id;
    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }

    const body = requestSchema.parse(await request.json());
    const binding = createBootstrapBinding({
      tenantId,
      tunnelId: body.tunnelId,
      clientPublicKey: body.clientPublicKey,
      emailHash: body.emailHash,
    });

    const storedChallenge = await challengeStore.consume(body.challengeId, tenantId);
    if (!storedChallenge) {
      throw new NotFoundError("Bootstrap challenge not found or expired");
    }

    if (storedChallenge.emailHash !== binding) {
      await challengeThrottleService.recordFailedAttempt(binding, "passkey");
      throw new ValidationError("Invalid bootstrap challenge binding");
    }

    const digest = createBootstrapPowDigest({
      nonce: storedChallenge.challenge,
      tunnelId: body.tunnelId,
      clientPublicKey: body.clientPublicKey,
      counter: body.counter,
    });

    if (!matchesPowDifficulty(digest, NEW_CLIENT_BOOTSTRAP_DIFFICULTY)) {
      await challengeThrottleService.recordFailedAttempt(binding, "passkey");
      throw new ValidationError("Invalid bootstrap proof of work");
    }

    await challengeThrottleService.clearThrottle(binding, "passkey");

    const bookingAccessToken = await generateNewClientBootstrapToken({
      tenantId,
      tunnelId: body.tunnelId,
      clientPublicKey: body.clientPublicKey,
      emailHash: body.emailHash,
    });

    const response: BootstrapVerifyResponse = {
      valid: true,
      bookingAccessToken,
    };

    logger.info("Verified bootstrap challenge for new client", {
      tenantId,
      challengeId: body.challengeId,
      tunnelId: body.tunnelId,
    });

    return json(response);
  } catch (error) {
    logError(logger)("Failed to verify bootstrap challenge", error);
    if (error instanceof z.ZodError) {
      return new ValidationError("Invalid request data").toJson();
    }
    if (error instanceof BackendError) {
      return error.toJson();
    }
    return new InternalError().toJson();
  }
};
