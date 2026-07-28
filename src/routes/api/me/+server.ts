/**
 * API Route: Dashboard User manages their own account
 */

import { logger } from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UserService } from "$lib/server/services/user-service";
import {
  AuthenticationError,
  BackendError,
  InternalError,
  logError,
  ValidationError,
} from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { z } from "zod";

const requestSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  language: z.enum(["de", "en"]).optional(),
});

// Register OpenAPI documentation for DELETE
registerOpenAPIRoute("/me", "PUT", {
  summary: "Update current account",
  description: "Allows a staff member to update their current account settings.",
  tags: ["Staff", "Account"],
  requestBody: {
    description: "Account data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the staff member",
            },
            language: {
              type: "string",
              description: "ISO 639-1 Code",
            },
          },
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Account settings changed",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                example: "John Doe",
              },
              language: {
                type: "string",
                example: "en",
              },
            },
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
  const log = logger.setContext("API.Me");

  try {
    if (!locals.user) {
      throw new AuthenticationError("Unauthorized");
    }

    const body = await request.json();
    const updateData = requestSchema.parse(body);

    log.debug("Staff member updating their account", {
      userId: locals.user.id,
      updateData,
    });

    // Delete appointment with authentication verification
    const user = await UserService.updateUser(locals.user.id, updateData);

    log.debug("User updated", {
      userId: locals.user.id,
    });

    return json({
      name: user.name,
      language: user.language,
    });
  } catch (error) {
    logError(log)("Error updating user", error);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    if (error instanceof z.ZodError) {
      return new ValidationError("Invalid request data").toJson();
    }

    return new InternalError().toJson();
  }
};
