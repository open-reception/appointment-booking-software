import { ERRORS } from "$lib/errors";
import logger from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { ChannelService, type ChannelWithRelations } from "$lib/server/services/channel-service";
import { InternalError, logError, NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { getTenantIdByDomain } from "../utils";

// Register OpenAPI documentation
registerOpenAPIRoute("/public/channels", "GET", {
  summary: "Get public channels",
  description: "Retrieves the channels to display the appointment booking form",
  tags: ["Channels"],
  responses: {
    "200": {
      description: "Retrieved data successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              channels: { type: "string", description: "TBD" },
            },
            required: ["channels"],
          },
          example: {
            channels: "tbd",
          },
        },
      },
    },
    "400": {
      description: "Incomplete tenant setup",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "This thenant is not properly set up to collect appointments" },
        },
      },
    },
    "404": {
      description: "No tenant found on this instance OR tenant with this domain not found",
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

export const GET: RequestHandler = async ({ locals, url }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = await getTenantIdByDomain(url.hostname, true);

    if (!tenantId) {
      return new NotFoundError(ERRORS.TENANTS.NONE_FOUND).toJson();
    }

    log.debug("Getting public tenant data");

    const channelService = await ChannelService.forTenant(tenantId);
    const channels = await channelService.getAllChannels();

    type PublicChannel = Pick<
      ChannelWithRelations,
      "id" | "names" | "descriptions" | "requiresConfirmation"
    >;
    const filteredChannels = channels
      .filter((c) => !c.pause && c.isPublic)
      .reduce<PublicChannel[]>((list, ch) => {
        if (ch.agents.length > 0) {
          return [
            ...list,
            {
              id: ch.id,
              names: ch.names,
              descriptions: ch.descriptions,
              requiresConfirmation: ch.requiresConfirmation,
            },
          ];
        } else {
          return list;
        }
      }, []);

    return json({
      channels: filteredChannels,
    });
  } catch (error) {
    logError(log)("Error getting public tenant data", error, locals.user?.id);
    return new InternalError().toJson();
  }
};
