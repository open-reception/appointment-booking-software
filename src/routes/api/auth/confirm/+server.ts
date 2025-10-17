import { json } from "@sveltejs/kit";
import { UserService } from "$lib/server/services/user-service";
import { BackendError, InternalError, logError } from "$lib/server/utils/errors";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation
registerOpenAPIRoute("/auth/confirm", "POST", {
  summary: "Confirm user account",
  description: "Confirms a user account using the email confirmation token",
  tags: ["Authentication"],
  requestBody: {
    description: "Confirmation token",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "Confirmation token from email",
              example: "01234567-89ab-cdef-0123-456789abcdef",
            },
          },
          required: ["token"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "User account confirmed successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              recoveryPassphrase: { type: "string", description: "Optional recovery passphrase" },
              isSetup: {
                type: "string",
                description: "Whether this is the first account that was setup on the server",
              },
              id: { type: "string", description: "user uuid" },
              email: { type: "string", description: "user email" },
            },
            required: ["message"],
          },
          example: {
            message: "User account confirmed successfully. You can now log in.",
          },
        },
      },
    },
    "404": {
      description: "Invalid or expired confirmation token",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Invalid or expired confirmation token" },
        },
      },
    },
    "500": {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Internal server error" },
        },
      },
    },
  },
});

export const POST: RequestHandler = async ({ request }) => {
  const log = logger.setContext("API");

  try {
    const body = await request.json();

    const confirmationResult = await UserService.confirm(body.token);

    const response: Record<string, string | boolean> = {
      message: "User account confirmed successfully. You can now log in.",
      isSetup: confirmationResult.isSetup,
      id: confirmationResult.id,
      email: confirmationResult.email,
    };

    // Include recovery passphrase if it exists (for WebAuthn-only users)
    if (confirmationResult.recoveryPassphrase) {
      response.recoveryPassphrase = confirmationResult.recoveryPassphrase;
      response.recoveryMessage =
        "Please save this recovery passphrase in a secure location. It will not be shown again.";
    }

    return json(response, { status: 200 });
  } catch (error) {
    logError(log)("User confirmation error", error);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
