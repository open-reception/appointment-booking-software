import { ERRORS } from "$lib/errors";
import logger from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { ChannelService } from "$lib/server/services/channel-service";
import { InternalError, logError, NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { getTenantIdByDomain } from "../../../utils";

// Register OpenAPI documentation
registerOpenAPIRoute("/tenants/public/channels/{id}/agents", "GET", {
  summary: "Get agents for a channel",
  description: "Shows all available agents for a channel",
  tags: ["Tenants", "Channels", "Agents"],
  responses: {
    "200": {
      description: "List of agents",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              agents: { type: "string", description: "TBD" },
            },
            required: ["agents"],
          },
          example: {
            agents: "tbd",
          },
        },
      },
    },
    "404": {
      description: "Tenant or channel not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Tenant not found on this instance" },
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

export const GET: RequestHandler = async ({ locals, url, params }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = await getTenantIdByDomain(url.hostname);
    if (!tenantId) {
      return new NotFoundError(ERRORS.TENANTS.NOT_FOUND).toJson();
    }

    const channelId = params.id;
    if (!channelId) {
      return new NotFoundError(ERRORS.CHANNELS.NOT_FOUND).toJson();
    }

    log.debug("Getting public agents for channel", { channelId, tenantId });

    const channelService = await ChannelService.forTenant(tenantId);
    const channel = await channelService.getChannelById(channelId);

    const filteredAgents =
      channel?.agents.map((a) => ({
        id: a.id,
        name: a.name,
        descriptions: a.descriptions,
        image: a.image,
      })) || [];

    return json({
      agents: filteredAgents,
    });
  } catch (error) {
    logError(log)("Error getting public agents for channel", error, locals.user?.userId);
    return new InternalError().toJson();
  }
};
