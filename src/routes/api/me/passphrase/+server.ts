/**
 * API Route: Dashboard User manages their own account
 */

import { logger } from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { challengeThrottleService } from "$lib/server/services/challenge-throttle";
import { UserService } from "$lib/server/services/user-service";
import {
  AuthenticationError,
  AuthorizationError,
  BackendError,
  InternalError,
  logError,
  ValidationError,
} from "$lib/server/utils/errors";
import { hashPassphrase, verifyPassphrase } from "$lib/server/utils/passphrase";
import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { z } from "zod";

const requestSchema = z.object({
  passphrase: z.string().min(30).max(100).optional(),
  newPassphrase: z.string().min(30).max(100),
});

// Register OpenAPI documentation for DELETE
registerOpenAPIRoute("/me/passphrase", "PUT", {
  summary: "Update current account passphrase",
  description: "Allows a global admins to update their passphrase.",
  tags: ["Staff", "Account"],
  requestBody: {
    description: "Account data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            passphrase: {
              type: "string",
              description: "Current passphrase",
            },
            newPassphrase: {
              type: "string",
              description: "New passphrase",
            },
          },
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Passphrase changed",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {},
          },
        },
      },
    },
    "400": {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "401": {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "403": {
      description: "Forbidden. This account cannot set a passphrase",
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

export const PUT: RequestHandler = async ({ request, locals }) => {
  const log = logger.setContext("API.Me.Passphrase");

  try {
    if (!locals.user) {
      throw new AuthenticationError("Unauthorized");
    }

    if (locals.user.role !== "GLOBAL_ADMIN") {
      throw new AuthorizationError("This user cannot set a passphrase");
    }

    const body = await request.json();
    const updateData = requestSchema.parse(body);

    const user = await UserService.getUserByEmail(locals.user.email);
    // Check passphrase, if user currently has a passphrase set
    if (user.passphraseHash) {
      const isPassphraseValid = await verifyPassphrase(user.passphraseHash || "", body.passphrase);
      if (!isPassphraseValid) {
        await challengeThrottleService.recordFailedAttempt(user.email, "passphrase");
        return json({ error: "Invalid passphrase" }, { status: 401 });
      }
      // Clear throttle on successful passphrase check
      await challengeThrottleService.clearThrottle(user.email, "passphrase");
    }

    log.debug("User setting new passphrase", {
      userId: locals.user.id,
    });

    const passphraseHash = await hashPassphrase(updateData.newPassphrase);
    await UserService.updateUser(locals.user.id, { passphraseHash });

    log.debug("User passphrase updated", {
      userId: locals.user.id,
    });

    return json({});
  } catch (error) {
    logError(log)("Error updating user passphrase", error);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    if (error instanceof z.ZodError) {
      return new ValidationError("Invalid request data").toJson();
    }

    return new InternalError().toJson();
  }
};
