import { ERRORS } from "$lib/errors";
import logger from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { InternalError, logError, NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { getTenantIdByDomain } from "../utils";

// Register OpenAPI documentation
registerOpenAPIRoute("/public/domains", "GET", {
  summary: "Get public tenant data",
  description: "Checks if a domain belongs to this server",
  tags: ["Tenants"],
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
      description: "The request does not contain the proper format",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Malformatted request" },
        },
      },
    },
    "404": {
      description: "Domain not found on this instance",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Domain not found on this instance" },
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

export const GET: RequestHandler = async ({ url }) => {
  const log = logger.setContext("API");

  const domain = url.searchParams.get("domain");

  if (!domain) {
    return new NotFoundError(ERRORS.DOMAINS.QUERY_MISSING).toJson();
  }

  try {
    const tenantId = await getTenantIdByDomain(domain);

    if (!tenantId) {
      return new NotFoundError(ERRORS.DOMAINS.NOT_FOUND).toJson();
    }

    return json({});
  } catch (error) {
    logError(log)(`Error verifying domain ${domain}`, error);
    return new InternalError().toJson();
  }
};
