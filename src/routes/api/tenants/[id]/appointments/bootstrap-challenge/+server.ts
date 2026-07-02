import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { logger } from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { challengeStore } from "$lib/server/services/challenge-store";
import { challengeThrottleService } from "$lib/server/services/challenge-throttle";
import { BackendError, InternalError, ValidationError, logError } from "$lib/server/utils/errors";
import {
  createBootstrapBinding,
  NEW_CLIENT_BOOTSTRAP_DIFFICULTY,
} from "$lib/server/services/bootstrap-challenge";
import type { BootstrapChallengeResponse } from "$lib/types/appointment";

const requestSchema = z.object({
  tunnelId: z.string().uuid(),
  clientPublicKey: z.string().min(1),
  emailHash: z.string().optional(),
});

registerOpenAPIRoute("/tenants/{id}/appointments/bootstrap-challenge", "POST", {
  summary: "Create bootstrap challenge for new client",
  description:
    "Creates a nonce-based proof-of-work challenge for a new client before first appointment creation.",
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
    description: "Bootstrap challenge input",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            tunnelId: { type: "string", format: "uuid" },
            clientPublicKey: { type: "string" },
            emailHash: { type: "string" },
          },
          required: ["tunnelId", "clientPublicKey"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Bootstrap challenge created successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              challengeId: { type: "string" },
              nonce: { type: "string" },
              difficulty: { type: "integer" },
            },
            required: ["challengeId", "nonce", "difficulty"],
          },
        },
      },
    },
    "422": {
      description: "Invalid request data",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "429": {
      description: "Too many bootstrap attempts",
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

    const throttleResult = await challengeThrottleService.checkThrottle(binding, "passkey");
    if (!throttleResult.allowed) {
      return json(
        {
          error: "Too many bootstrap attempts. Please try again later.",
          retryAfterMs: throttleResult.retryAfterMs,
        },
        { status: 429 },
      );
    }

    const challengeId = randomBytes(16).toString("hex");
    const nonce = randomBytes(32).toString("base64");

    await challengeStore.store(challengeId, nonce, binding, tenantId);

    const response: BootstrapChallengeResponse = {
      challengeId,
      nonce,
      difficulty: NEW_CLIENT_BOOTSTRAP_DIFFICULTY,
    };

    logger.info("Created bootstrap challenge for new client", {
      tenantId,
      challengeId,
      tunnelId: body.tunnelId,
    });

    return json(response);
  } catch (error) {
    logError(logger)("Failed to create bootstrap challenge", error);
    if (error instanceof z.ZodError) {
      return new ValidationError("Invalid request data").toJson();
    }
    if (error instanceof BackendError) {
      return error.toJson();
    }
    return new InternalError().toJson();
  }
};
