import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { checkPermission } from "$lib/server/utils/permissions";
import { ValidationError, logError, BackendError } from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";

const requestSchema = z.object({
  emailHash: z.string().min(64).max(64),
});

registerOpenAPIRoute("/tenants/{id}/clients/exists", "POST", {
  summary: "Check if client exists",
  description:
    "Check if a client with the given email hash already exists in the tenant's database. Requires staff permissions.",
  tags: ["Clients"],
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
    description: "Email hash to check",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            emailHash: {
              type: "string",
              description: "SHA-256 hash of client email (64 hex characters)",
              minLength: 64,
              maxLength: 64,
            },
          },
          required: ["emailHash"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Client existence check result",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              exists: {
                type: "boolean",
                description: "Whether a client with this email hash exists",
              },
              emailHash: {
                type: "string",
                description: "The email hash that was checked (first 8 characters)",
              },
            },
            required: ["exists", "emailHash"],
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
    "401": {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "403": {
      description: "Staff permissions required",
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

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const tenantId = params.id!;

  try {
    logger.debug("Client exists check request", { tenantId, userId: locals.user?.id });

    // Check permissions
    await checkPermission(locals, tenantId);

    // Parse and validate request
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    logger.debug("Request validated", { emailHashPrefix: validatedData.emailHash.slice(0, 8) });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const tunnels = await appointmentService.getClientTunnels();
    const exists = tunnels.some((t) => t.emailHash === validatedData.emailHash);

    logger.debug("Client exists check completed", {
      tenantId,
      exists,
      emailHashPrefix: validatedData.emailHash.slice(0, 8),
    });

    return json({
      exists,
      emailHash: validatedData.emailHash.slice(0, 8),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Validation error in client exists check", {
        tenantId,
        error,
      });
      return json({ error: "Invalid request data", details: error }, { status: 400 });
    }

    if (error instanceof ValidationError) {
      logger.warn("Validation error", { tenantId, error: error.message });
      return json({ error: error.message }, { status: 400 });
    }

    logError(logger)("General Error", error as BackendError, "client-exists-check", tenantId);
    return json({ error: "Failed to check client existence" }, { status: 500 });
  }
};
