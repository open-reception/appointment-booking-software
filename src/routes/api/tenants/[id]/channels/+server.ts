import { json } from "@sveltejs/kit";
import { ChannelService } from "$lib/server/services/channel-service";
import { ValidationError, logError, BackendError, InternalError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";
import { ERRORS } from "$lib/errors";

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/channels", "POST", {
  summary: "Create a new channel",
  description:
    "Creates a new channel for a specific tenant. Only global admins and tenant admins can create channels.",
  tags: ["Channels"],
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
    description: "Channel creation data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            names: {
              type: "object",
              additionalProperties: true,
              description: "Localized channel names. Keys are locale codes.",
              example: { en: "Support", de: "Unterstützung" },
            },
            color: {
              type: "string",
              description: "Channel color (optional, will be auto-assigned if not provided)",
              example: "#FF0000",
            },
            descriptions: {
              type: "object",
              additionalProperties: true,
              description: "Localized channel descriptions. Keys are locale codes.",
              example: { en: "Some description", de: "Eine Beschreibung" },
            },
            isPublic: {
              type: "boolean",
              description: "Whether the channel is publicly visible",
              example: true,
            },
            requiresConfirmation: {
              type: "boolean",
              description: "Whether appointments require confirmation",
              example: false,
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
                  name: {
                    type: "string",
                    minLength: 1,
                    maxLength: 100,
                    description: "Template name",
                  },
                  weekdays: { type: "number", description: "Weekdays bitmask" },
                  from: { type: "string", description: "Start time ((HH:MM))" },
                  to: { type: "string", description: "End time (HH:MM)" },
                  duration: { type: "number", description: "Slot duration in minutes" },
                },
                required: ["name", "from", "to", "duration"],
              },
              description: "Slot templates for the channel",
            },
          },
          required: ["names", "languages"],
        },
      },
    },
  },
  responses: {
    "201": {
      description: "Channel created successfully",
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
                  names: { type: "object", description: "Localized Channel names" },
                  color: { type: "string", description: "Channel color" },
                  descriptions: {
                    type: "object",
                    description: "Localized Channel descriptions",
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
                        descriptions: { type: "object" },
                        image: { type: "string" },
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
                required: ["id", "names", "agents", "slotTemplates"],
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

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/channels", "GET", {
  summary: "List all channels",
  description:
    "Retrieves all channels for a specific tenant with their agents and slot templates. Only global admins and tenant admins can view channels.",
  tags: ["Channels"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
  ],
  responses: {
    "200": {
      description: "Channels retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              channels: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid", description: "Channel ID" },
                    names: { type: "object", description: "Localized Channel names" },
                    color: { type: "string", description: "Channel color" },
                    descriptions: {
                      type: "object",
                      description: "Localized Channel descriptions",
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
                          descriptions: { type: "object" },
                          image: { type: "string" },
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
                  required: ["id", "names", "agents", "slotTemplates"],
                },
              },
            },
            required: ["channels"],
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

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;

    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    checkPermission(locals, tenantId, true);

    const body = await request.json();

    log.debug("Creating new channel", {
      tenantId,
      requestedBy: locals.user?.userId,
      channelNames: body.names,
      languages: body.languages,
    });

    const channelService = await ChannelService.forTenant(tenantId);
    const newChannel = await channelService.createChannel(body);

    log.debug("Channel created successfully", {
      tenantId,
      channelId: newChannel.id,
      requestedBy: locals.user?.userId,
    });

    return json(
      {
        message: "Channel created successfully",
        channel: newChannel,
      },
      { status: 201 },
    );
  } catch (error) {
    logError(log)("Error creating channel", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

export const GET: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;

    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    checkPermission(locals, tenantId);

    log.debug("Getting all channels", {
      tenantId,
      requestedBy: locals.user?.userId,
    });

    const channelService = await ChannelService.forTenant(tenantId);
    const channels = await channelService.getAllChannels();

    log.debug("Channels retrieved successfully", {
      tenantId,
      count: channels.length,
      requestedBy: locals.user?.userId,
    });

    return json({
      channels,
    });
  } catch (error) {
    logError(log)("Error in getting channels", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }
    return new InternalError().toJson();
  }
};
