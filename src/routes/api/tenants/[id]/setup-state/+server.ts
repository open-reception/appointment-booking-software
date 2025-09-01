import { json } from "@sveltejs/kit";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import z from "zod/v4";

const setupStateSchema = z.object({
  setupState: z.enum(["NEW", "SETTINGS_CREATED", "AGENTS_SET_UP", "FIRST_CHANNEL_CREATED"]),
});

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}/setup-state", "PUT", {
  summary: "Update tenant setup state",
  description: "Updates the setup state for a specific tenant",
  tags: ["Tenants"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string" },
      description: "Tenant ID",
    },
  ],
  requestBody: {
    description: "Setup state update",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            setupState: {
              type: "string",
              enum: ["NEW", "SETTINGS_CREATED", "AGENTS_SET_UP", "FIRST_CHANNEL_CREATED"],
              description: "The new setup state for the tenant",
            },
          },
          required: ["setupState"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Tenant setup state updated successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              tenant: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Tenant ID" },
                  setupState: {
                    type: "string",
                    enum: ["NEW", "SETTINGS_CREATED", "AGENTS_SET_UP", "FIRST_CHANNEL_CREATED"],
                    description: "Current setup state",
                  },
                  updatedAt: {
                    type: "string",
                    format: "date-time",
                    description: "Last update timestamp",
                  },
                },
              },
            },
            required: ["message", "tenant"],
          },
        },
      },
    },
    "400": {
      description: "Invalid input data",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Tenant not found",
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

export const PUT: RequestHandler = async ({ params, request }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const body = await request.json();

    log.debug("Updating tenant setup state", {
      tenantId,
      setupState: body.setupState,
    });

    if (!tenantId) {
      return json({ error: "No tenant id given" }, { status: 400 });
    }

    const validation = setupStateSchema.safeParse(body);
    if (!validation.success) {
      return json({ error: "Invalid setup state" }, { status: 400 });
    }

    const tenantService = await TenantAdminService.getTenantById(tenantId);
    const updatedTenant = await tenantService.setSetupState(validation.data.setupState);

    log.debug("Tenant setup state updated successfully", {
      tenantId,
      setupState: validation.data.setupState,
    });

    return json({
      message: "Tenant setup state updated successfully",
      tenant: updatedTenant,
    });
  } catch (error) {
    log.error("Error updating tenant setup state:", JSON.stringify(error || "?"));

    if (error instanceof ValidationError) {
      return json({ error: error.message }, { status: 400 });
    }

    if (error instanceof NotFoundError) {
      return json({ error: "Tenant not found" }, { status: 404 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};
