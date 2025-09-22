import { json } from "@sveltejs/kit";
import { AgentService } from "$lib/server/services/agent-service";
import {
  ValidationError,
  NotFoundError,
  logError,
  BackendError,
  InternalError,
} from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/agents/{agentId}/absences/{absenceId}", "GET", {
  summary: "Get specific absence",
  description:
    "Retrieves details of a specific agent absence. Global admins, tenant admins, and staff can view absences.",
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
      name: "agentId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Agent ID",
    },
    {
      name: "absenceId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Absence ID",
    },
  ],
  responses: {
    "200": {
      description: "Absence details retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              absence: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid", description: "Absence ID" },
                  agentId: { type: "string", format: "uuid", description: "Agent ID" },
                  startDate: { type: "string", format: "date-time", description: "Start date" },
                  endDate: { type: "string", format: "date-time", description: "End date" },
                  absenceType: { type: "string", description: "Type of absence" },
                  description: { type: "string", description: "Description" },
                  isFullDay: { type: "boolean", description: "Full day absence" },
                },
                required: ["id", "agentId", "startDate", "endDate", "absenceType", "isFullDay"],
              },
            },
            required: ["absence"],
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
      description: "Absence, agent, or tenant not found",
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
registerOpenAPIRoute("/tenants/{id}/agents/{agentId}/absences/{absenceId}", "PUT", {
  summary: "Update agent absence",
  description:
    "Updates an existing agent absence. Global admins, tenant admins, and staff can update absences.",
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
      name: "agentId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Agent ID",
    },
    {
      name: "absenceId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Absence ID",
    },
  ],
  requestBody: {
    description: "Absence update data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              format: "date-time",
              description: "Start date and time of absence",
              example: "2024-01-15T00:00:00.000Z",
            },
            endDate: {
              type: "string",
              format: "date-time",
              description: "End date and time of absence",
              example: "2024-01-17T23:59:59.999Z",
            },
            absenceType: {
              type: "string",
              maxLength: 100,
              description: "Type of absence (free text)",
              example: "Krankheit",
            },
            description: {
              type: "string",
              description: "Optional description of the absence",
              example: "Erkältung",
            },
            isFullDay: {
              type: "boolean",
              description: "Whether this is a full day absence",
              example: false,
            },
          },
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Absence updated successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              absence: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid", description: "Absence ID" },
                  agentId: { type: "string", format: "uuid", description: "Agent ID" },
                  startDate: { type: "string", format: "date-time", description: "Start date" },
                  endDate: { type: "string", format: "date-time", description: "End date" },
                  absenceType: { type: "string", description: "Type of absence" },
                  description: { type: "string", description: "Description" },
                  isFullDay: { type: "boolean", description: "Full day absence" },
                },
                required: ["id", "agentId", "startDate", "endDate", "absenceType", "isFullDay"],
              },
            },
            required: ["message", "absence"],
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
      description: "Absence, agent, or tenant not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "409": {
      description: "Absence period overlaps with existing absence",
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
registerOpenAPIRoute("/tenants/{id}/agents/{agentId}/absences/{absenceId}", "DELETE", {
  summary: "Delete agent absence",
  description:
    "Deletes an agent absence. Global admins, tenant admins, and staff can delete absences.",
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
      name: "agentId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Agent ID",
    },
    {
      name: "absenceId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Absence ID",
    },
  ],
  responses: {
    "200": {
      description: "Absence deleted successfully",
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
      description: "Absence, agent, or tenant not found",
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
    const agentId = params.agentId;
    const absenceId = params.absenceId;

    // Check if user is authenticated
    if (!tenantId || !agentId || !absenceId) {
      throw new ValidationError("Missing tenant, agent, or absence ID");
    }

    checkPermission(locals, tenantId);

    log.debug("Getting absence details", {
      tenantId,
      agentId,
      absenceId,
      requestedBy: locals.user?.userId,
    });

    const agentService = await AgentService.forTenant(tenantId);
    const absence = await agentService.getAbsenceById(absenceId);

    if (!absence) {
      throw new NotFoundError("Absence not found");
    }

    // Verify the absence belongs to the requested agent
    if (absence.agentId !== agentId) {
      throw new NotFoundError("Absence not found for this agent");
    }

    log.debug("Absence details retrieved successfully", {
      tenantId,
      agentId,
      absenceId,
      requestedBy: locals.user?.userId,
    });

    return json({
      absence,
    });
  } catch (error) {
    logError(log)("Error getting absence details", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const agentId = params.agentId;
    const absenceId = params.absenceId;

    // Check if user is authenticated
    if (!tenantId || !agentId || !absenceId) {
      throw new ValidationError("Missing tenant, agent, or absence ID");
    }

    checkPermission(locals, tenantId);

    const body = await request.json();

    log.debug("Updating agent absence", {
      tenantId,
      agentId,
      absenceId,
      requestedBy: locals.user?.userId,
      updateFields: Object.keys(body),
    });

    const agentService = await AgentService.forTenant(tenantId);

    // First verify the absence exists and belongs to the agent
    const existingAbsence = await agentService.getAbsenceById(absenceId);
    if (!existingAbsence) {
      throw new NotFoundError("Absence not found");
    }

    if (existingAbsence.agentId !== agentId) {
      throw new NotFoundError("Absence not found for this agent");
    }

    const updatedAbsence = await agentService.updateAbsence(absenceId, body);

    log.debug("Agent absence updated successfully", {
      tenantId,
      agentId,
      absenceId,
      requestedBy: locals.user?.userId,
    });

    return json({
      message: "Absence updated successfully",
      absence: updatedAbsence,
    });
  } catch (error) {
    logError(log)("Error updating agent absence", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const agentId = params.agentId;
    const absenceId = params.absenceId;

    if (!tenantId || !agentId || !absenceId) {
      throw new ValidationError("Missing tenant, agent, or absence ID");
    }

    checkPermission(locals, tenantId);

    log.debug("Deleting agent absence", {
      tenantId,
      agentId,
      absenceId,
      requestedBy: locals.user?.userId,
    });

    const agentService = await AgentService.forTenant(tenantId);

    // First verify the absence exists and belongs to the agent
    const existingAbsence = await agentService.getAbsenceById(absenceId);
    if (!existingAbsence) {
      throw new NotFoundError("Absence not found");
    }

    if (existingAbsence.agentId !== agentId) {
      throw new NotFoundError("Absence not found for this agent");
    }

    const deleted = await agentService.deleteAbsence(absenceId);

    if (!deleted) {
      return json({ error: "Absence not found" }, { status: 404 });
    }

    log.debug("Agent absence deleted successfully", {
      tenantId,
      agentId,
      absenceId,
      requestedBy: locals.user?.userId,
    });

    return json({
      message: "Absence deleted successfully",
    });
  } catch (error) {
    logError(log)("Error deleting agent absence", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
