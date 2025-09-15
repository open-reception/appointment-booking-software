import { json } from "@sveltejs/kit";
import { ChannelService } from "$lib/server/services/channel-service";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/channels/{channelId}", "GET", {
  summary: "Get channel details",
  description:
    "Retrieves detailed information about a specific channel including agents and slot templates. Only global admins and tenant admins can view channel details.",
  tags: ["Channels"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "channelId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Channel ID",
    },
  ],
  responses: {
    "200": {
      description: "Channel details retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              channel: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid", description: "Channel ID" },
                  names: { type: "array", items: { type: "string" }, description: "Channel names" },
                  color: { type: "string", description: "Channel color" },
                  descriptions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Channel descriptions",
                  },
                  languages: {
                    type: "array",
                    items: { type: "string" },
                    description: "Supported languages",
                  },
                  isPublic: { type: "boolean", description: "Public visibility" },
                  requiresConfirmation: { type: "boolean", description: "Requires confirmation" },
                  agents: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        name: { type: "string" },
                        description: { type: "string" },
                        logo: { type: "string", format: "byte" },
                      },
                    },
                  },
                  slotTemplates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        weekdays: { type: "number" },
                        from: { type: "string" },
                        to: { type: "string" },
                        duration: { type: "number" },
                      },
                    },
                  },
                },
                required: ["id", "names", "languages", "agents", "slotTemplates"],
              },
            },
            required: ["channel"],
          },
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
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Channel or tenant not found",
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

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}/channels/{channelId}", "PUT", {
  summary: "Update a channel",
  description:
    "Updates an existing channel for a specific tenant. Only global admins and tenant admins can update channels.",
  tags: ["Channels"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "channelId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Channel ID",
    },
  ],
  requestBody: {
    description: "Channel update data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string", minLength: 1, maxLength: 100 },
              description: "Channel names (one per language)",
              example: ["Updated Support", "Aktualisierte Unterstützung"],
            },
            color: {
              type: "string",
              description: "Channel color",
              example: "#00FF00",
            },
            descriptions: {
              type: "array",
              items: { type: "string" },
              description: "Channel descriptions (one per language)",
              example: ["Updated customer support channel", "Aktualisierter Kundensupport-Kanal"],
            },
            languages: {
              type: "array",
              items: { type: "string", minLength: 2, maxLength: 5 },
              description: "Supported languages",
              example: ["en", "de"],
            },
            isPublic: {
              type: "boolean",
              description: "Whether the channel is publicly visible",
              example: false,
            },
            requiresConfirmation: {
              type: "boolean",
              description: "Whether appointments require confirmation",
              example: true,
            },
            agentIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
              description: "IDs of agents to assign to this channel",
              example: ["01234567-89ab-cdef-0123-456789abcdef"],
            },
            slotTemplates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    format: "uuid",
                    description: "Template ID (for existing templates)",
                  },
                  name: {
                    type: "string",
                    minLength: 1,
                    maxLength: 100,
                    description: "Template name",
                  },
                  weekdays: { type: "number", description: "Weekdays bitmask" },
                  from: { type: "string", description: "Start time (HH:MM)" },
                  to: { type: "string", description: "End time (HH:MM)" },
                  duration: { type: "number", description: "Slot duration in minutes" },
                },
                required: ["from", "to", "duration"],
              },
              description: "Slot templates for the channel",
            },
          },
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Channel updated successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              channel: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid", description: "Channel ID" },
                  names: { type: "array", items: { type: "string" }, description: "Channel names" },
                  color: { type: "string", description: "Channel color" },
                  descriptions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Channel descriptions",
                  },
                  languages: {
                    type: "array",
                    items: { type: "string" },
                    description: "Supported languages",
                  },
                  isPublic: { type: "boolean", description: "Public visibility" },
                  requiresConfirmation: { type: "boolean", description: "Requires confirmation" },
                  agents: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        name: { type: "string" },
                        description: { type: "string" },
                        logo: { type: "string", format: "byte" },
                      },
                    },
                  },
                  slotTemplates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        weekdays: { type: "number" },
                        from: { type: "string" },
                        to: { type: "string" },
                        duration: { type: "number" },
                      },
                    },
                  },
                },
                required: ["id", "names", "languages", "agents", "slotTemplates"],
              },
            },
            required: ["message", "channel"],
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
    "401": {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "403": {
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Channel or tenant not found",
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

// Register OpenAPI documentation for DELETE
registerOpenAPIRoute("/tenants/{id}/channels/{channelId}", "DELETE", {
  summary: "Delete a channel",
  description:
    "Deletes an existing channel from a specific tenant. Only global admins and tenant admins can delete channels. This will also remove all agent assignments and slot templates that are not used by other channels.",
  tags: ["Channels"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "channelId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Channel ID",
    },
  ],
  responses: {
    "200": {
      description: "Channel deleted successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
            },
            required: ["message"],
          },
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
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Channel or tenant not found",
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

export const GET: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const channelId = params.channelId;

    if (!tenantId || !channelId) {
      return json({ error: "Missing tenant or channel ID" }, { status: 400 });
    }

    const error = checkPermission(locals, tenantId, true);
    if (error) {
      return error;
    }

    log.debug("Getting channel details", {
      tenantId,
      channelId,
      requestedBy: locals.user?.userId,
    });

    const channelService = await ChannelService.forTenant(tenantId);
    const channel = await channelService.getChannelById(channelId);

    if (!channel) {
      return json({ error: "Channel not found" }, { status: 404 });
    }

    log.debug("Channel details retrieved successfully", {
      tenantId,
      channelId,
      requestedBy: locals.user?.userId,
    });

    return json({
      channel,
    });
  } catch (error) {
    log.error("Error getting channel details:", JSON.stringify(error || "?"));

    if (error instanceof NotFoundError) {
      return json({ error: "Channel not found" }, { status: 404 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const channelId = params.channelId;

    if (!tenantId || !channelId) {
      return json({ error: "Missing tenant or channel ID" }, { status: 400 });
    }

    const error = checkPermission(locals, tenantId, true);
    if (error) {
      return error;
    }

    const body = await request.json();

    log.debug("Updating channel", {
      tenantId,
      channelId,
      requestedBy: locals.user?.userId,
      updateFields: Object.keys(body),
    });

    const channelService = await ChannelService.forTenant(tenantId);
    const updatedChannel = await channelService.updateChannel(channelId, body);

    log.debug("Channel updated successfully", {
      tenantId,
      channelId,
      requestedBy: locals.user?.userId,
    });

    return json({
      message: "Channel updated successfully",
      channel: updatedChannel,
    });
  } catch (error) {
    log.error("Error updating channel:", JSON.stringify(error || "?"));

    if (error instanceof ValidationError) {
      return json({ error: error.message }, { status: 400 });
    }

    if (error instanceof NotFoundError) {
      return json({ error: "Channel not found" }, { status: 404 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const channelId = params.channelId;

    if (!tenantId || !channelId) {
      return json({ error: "Missing tenant or channel ID" }, { status: 400 });
    }

    const error = checkPermission(locals, tenantId, true);
    if (error) {
      return error;
    }

    log.debug("Deleting channel", {
      tenantId,
      channelId,
      requestedBy: locals.user?.userId,
    });

    const channelService = await ChannelService.forTenant(tenantId);
    const deleted = await channelService.deleteChannel(channelId);

    if (!deleted) {
      return json({ error: "Channel not found" }, { status: 404 });
    }

    log.debug("Channel deleted successfully", {
      tenantId,
      channelId,
      requestedBy: locals.user?.userId,
    });

    return json({
      message: "Channel deleted successfully",
    });
  } catch (error) {
    log.error("Error deleting channel:", JSON.stringify(error || "?"));

    if (error instanceof NotFoundError) {
      return json({ error: "Channel not found" }, { status: 404 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};
