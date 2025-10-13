import { json } from "@sveltejs/kit";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation
registerOpenAPIRoute("/tenants/config/defaults", "GET", {
  summary: "Get default tenant configuration",
  description: "Returns the default configuration values for new tenants",
  tags: ["Tenants", "Configuration"],
  responses: {
    "200": {
      description: "Default configuration retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              brandColor: {
                type: "string",
                description: "Default brand color",
                example: "#E11E15",
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
            required: [
              "brandColor",
              "maxChannels",
              "maxTeamMembers",
              "autoDeleteDays",
              "requireEmail",
              "requirePhone",
            ],
          },
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

export const GET: RequestHandler = async () => {
  const log = logger.setContext("API");

  try {
    log.debug("Getting default tenant configuration");

    const defaults = TenantAdminService.getConfigDefaults();

    log.debug("Default configuration retrieved successfully");

    return json(defaults);
  } catch (error) {
    log.error("Error getting default configuration:", JSON.stringify(error || "?"));
    return json({ error: "Internal server error" }, { status: 500 });
  }
};
