import { json } from "@sveltejs/kit";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import z from "zod/v4";
import { checkPermission } from "$lib/server/utils/permissions";
import { ERRORS } from "$lib/errors";

const setupStateSchema = z.object({
  setupState: z.enum(["SETTINGS", "AGENTS", "CHANNELS", "STAFF", "READY"]),
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

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const body = await request.json();

    log.debug("Updating tenant setup state", {
      tenantId,
      setupState: body.setupState,
    });

    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    checkPermission(locals, tenantId, true);

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
    logError(log)("Error updating tenant setup state", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
