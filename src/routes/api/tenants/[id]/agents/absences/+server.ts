import { json } from "@sveltejs/kit";
import { AgentService } from "$lib/server/services/agent-service";
import { ValidationError, logError, BackendError, InternalError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/agents/absences", "GET", {
  summary: "Get all agent absences",
  description:
    "Retrieves all absences for a all agents. Global admins, tenant admins, and staff can view absences.",
  tags: ["Agent Absences"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "startDate",
      in: "query",
      required: false,
      schema: { type: "string", format: "date-time" },
      description: "Filter absences starting from this date",
    },
    {
      name: "endDate",
      in: "query",
      required: false,
      schema: { type: "string", format: "date-time" },
      description: "Filter absences ending before this date",
    },
  ],
  responses: {
    "200": {
      description: "Agent absences retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              absences: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid", description: "Absence ID" },
                    agentId: { type: "string", format: "uuid", description: "Agent ID" },
                    startDate: { type: "string", format: "date-time", description: "Start date" },
                    endDate: { type: "string", format: "date-time", description: "End date" },
                    absenceType: { type: "string", description: "Type of absence" },
                    description: { type: "string", description: "Description" },
                  },
                  required: ["id", "agentId", "startDate", "endDate", "absenceType", "isFullDay"],
                },
              },
            },
            required: ["absences"],
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
      description: "Agent or tenant not found",
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

export const GET: RequestHandler = async ({ params, locals, url }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;

    if (!tenantId) {
      throw new ValidationError("Missing tenant ID");
    }

    checkPermission(locals, tenantId);

    // Get optional query parameters for date filtering
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    log.debug("Getting all agents absences", {
      tenantId,
      requestedBy: locals.user?.userId,
      startDate,
      endDate,
    });

    const agentService = await AgentService.forTenant(tenantId);
    const absences = await agentService.getAbsences(startDate || undefined, endDate || undefined);

    log.debug("All Agents absences retrieved successfully", {
      tenantId,
      count: absences.length,
      requestedBy: locals.user?.userId,
    });

    return json({
      absences,
    });
  } catch (error) {
    logError(log)("Getting all agents absences failed", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
