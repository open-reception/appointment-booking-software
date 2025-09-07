import { json } from "@sveltejs/kit";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/config", "GET", {
  summary: "Get tenant configuration",
  description: "Returns the current configuration for a specific tenant",
  tags: ["Tenants", "Configuration"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string" },
      description: "Tenant ID",
    },
  ],
  responses: {
    "200": {
      description: "Tenant configuration retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              brandColor: { type: "string", description: "Brand color", example: "#E11E15" },
              defaultLanguage: {
                type: "string",
                description: "Default language code",
                example: "DE",
              },
              maxChannels: {
                type: "number",
                description: "Maximum channels (-1 for unlimited)",
                example: -1,
              },
              maxTeamMembers: {
                type: "number",
                description: "Maximum team members (-1 for unlimited)",
                example: -1,
              },
              autoDeleteDays: {
                type: "number",
                description: "Auto-delete data after days",
                example: 30,
              },
              requireEmail: {
                type: "boolean",
                description: "Require email for bookings",
                example: true,
              },
              requirePhone: {
                type: "boolean",
                description: "Require phone for bookings",
                example: false,
              },
            },
          },
        },
      },
    },
    "404": {
      description: "Tenant not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Tenant not found" },
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

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}/config", "PUT", {
  summary: "Update tenant configuration",
  description: "Updates the configuration for a specific tenant",
  tags: ["Tenants", "Configuration"],
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
    description: "Configuration updates",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            brandColor: { type: "string", description: "Brand color" },
            defaultLanguage: { type: "string", description: "Default language code" },
            maxChannels: { type: "number", description: "Maximum channels (-1 for unlimited)" },
            maxTeamMembers: {
              type: "number",
              description: "Maximum team members (-1 for unlimited)",
            },
            autoDeleteDays: { type: "number", description: "Auto-delete data after days" },
            requireEmail: { type: "boolean", description: "Require email for bookings" },
            requirePhone: { type: "boolean", description: "Require phone for bookings" },
          },
          additionalProperties: true,
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Configuration updated successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              updatedKeys: {
                type: "array",
                items: { type: "string" },
                description: "List of configuration keys that were updated",
              },
            },
            required: ["message", "updatedKeys"],
          },
          example: {
            message: "Configuration updated successfully",
            updatedKeys: ["brandColor", "requireEmail"],
          },
        },
      },
    },
    "400": {
      description: "Invalid input data",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Invalid configuration data" },
        },
      },
    },
    "404": {
      description: "Tenant not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Tenant not found" },
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

export const GET: RequestHandler = async ({ locals, params }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;

    log.debug("Getting tenant configuration", { tenantId });

    if (!tenantId) {
      return json({ error: "No tenant id given" }, { status: 400 });
    }

    const error = checkPermission(locals, tenantId, true);
    if (error) {
      return error;
    }

    const tenantService = await TenantAdminService.getTenantById(tenantId);
    const config = await tenantService.configuration;

    log.debug("Tenant configuration retrieved successfully", {
      tenantId,
      configKeys: Object.keys(config),
    });

    return json(config);
  } catch (error) {
    log.error("Error getting tenant configuration:", JSON.stringify(error || "?"));

    if (error instanceof NotFoundError) {
      return json({ error: "Tenant not found" }, { status: 404 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const body = await request.json();

    log.debug("Updating tenant configuration", {
      tenantId,
      configKeys: Object.keys(body),
    });

    if (!tenantId) {
      return json({ error: "No tenant id given" }, { status: 400 });
    }

    const error = checkPermission(locals, tenantId, true);
    if (error) {
      return error;
    }

    const tenantService = await TenantAdminService.getTenantById(tenantId);
    await tenantService.updateTenantConfig(body);

    log.debug("Tenant configuration updated successfully", {
      tenantId,
      configKeys: Object.keys(body),
    });

    return json({
      message: "Configuration updated successfully",
      updatedKeys: Object.keys(body),
    });
  } catch (error) {
    log.error("Error updating tenant configuration:", JSON.stringify(error || "?"));

    if (error instanceof ValidationError) {
      return json({ error: error.message }, { status: 400 });
    }

    if (error instanceof NotFoundError) {
      return json({ error: "Tenant not found" }, { status: 404 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};
