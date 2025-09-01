import { json } from "@sveltejs/kit";
import { UserService } from "$lib/server/services/user-service";
import { NotFoundError } from "$lib/server/utils/errors";
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
              message: { type: "string", description: "Success message" },
              isSetup: {
                type: "string",
                description: "Whether this is the first account that was setup on the server",
              },
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
  try {
    const body = await request.json();

    const confirmationResult = await UserService.confirm(body.token);

    const response: Record<string, string | boolean> = {
      message: "User account confirmed successfully. You can now log in.",
      isSetup: confirmationResult.isSetup,
    };

    // Include recovery passphrase if it exists (for WebAuthn-only users)
    if (confirmationResult.recoveryPassphrase) {
      response.recoveryPassphrase = confirmationResult.recoveryPassphrase;
      response.recoveryMessage =
        "Please save this recovery passphrase in a secure location. It will not be shown again.";
    }

    return json(response, { status: 200 });
  } catch (error) {
    const log = logger.setContext("API");
    log.error("User confirmation error:", JSON.stringify(error || "?"));

    if (error instanceof NotFoundError) {
      return json({ error: "Invalid or expired confirmation token" }, { status: 404 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};
