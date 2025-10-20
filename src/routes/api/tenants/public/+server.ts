import { ERRORS } from "$lib/errors";
import logger from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { ChannelService, type ChannelWithRelations } from "$lib/server/services/channel-service";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { InternalError, logError, NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { getTenantIdByDomain } from "./utils";

// Register OpenAPI documentation
registerOpenAPIRoute("/tenants/public", "GET", {
  summary: "Get public tenant data",
  description: "Retrieves the tenant data to display the appointment booking form",
  tags: ["Tenants", "Channels", "Agents"],
  responses: {
    "200": {
      description: "Retrieved data successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              tbd: { type: "string", description: "TBD" },
            },
            required: ["tbd"],
          },
          example: {
            tbd: "tbd",
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
    const tenantId = await getTenantIdByDomain(url.hostname);

    if (!tenantId) {
      return new NotFoundError(ERRORS.TENANTS.NONE_FOUND).toJson();
    }

    log.debug("Getting public tenant data");

    const tenantService = await TenantAdminService.getTenantById(tenantId);
    const config = tenantService.configuration.configuration;
    const tenantData = tenantService.tenantData;

    if (!tenantData) {
      throw new NotFoundError(ERRORS.TENANTS.NOT_FOUND);
    }

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
      tenant: {
        id: tenantData.id,
        shortName: tenantData.shortName,
        longName: tenantData.longName,
        descriptions: tenantData.descriptions,
        languages: tenantData.languages,
        defaultLanguage: tenantData.defaultLanguage,
        setupState: tenantData.setupState,
        links: tenantData.links,
        requireEmail: config.requireEmail,
        requirePhone: config.requirePhone,
        address: {
          street: config["address.street"] || "",
          number: config["address.number"] || "",
          additionalAddressInfo: config["address.additionalAddressInfo"] || "",
          zip: config["address.zip"] || "",
          city: config["address.city"] || "",
        },
        channels: filteredChannels,
        logo: tenantData.logo,
      },
    });
  } catch (error) {
    logError(log)("Error getting public tenant data", error, locals.user?.userId);
    return new InternalError().toJson();
  }
};
