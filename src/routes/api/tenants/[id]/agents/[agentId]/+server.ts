import { json } from "@sveltejs/kit";
import { AgentService } from "$lib/server/services/agent-service";
import {
  ValidationError,
  NotFoundError,
  logError,
  BackendError,
  InternalError,
  ConflictError,
} from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";
import { ERRORS } from "$lib/errors";
import { AppointmentService } from "$lib/server/services/appointment-service";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/agents/{agentId}", "GET", {
  summary: "Get agent details",
  description:
    "Retrieves detailed information about a specific agent. Global admins, tenant admins, and staff can view agent details.",
  tags: ["Agents"],
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
  ],
  responses: {
    "200": {
      description: "Agent details retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              agent: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid", description: "Agent ID" },
                  name: { type: "string", description: "Agent name" },
                  descriptions: { type: "object", description: "Localized Agent descriptions" },
                  image: { type: "string", description: "Agent image" },
                },
                required: ["id", "name"],
              },
            },
            required: ["agent"],
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

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}/agents/{agentId}", "PUT", {
  summary: "Update an agent",
  description:
    "Updates an existing agent for a specific tenant. Only global admins and tenant admins can update agents.",
  tags: ["Agents"],
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
  ],
  requestBody: {
    description: "Agent update data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              description: "Agent name",
              example: "Updated Support Agent",
            },
            descriptions: {
              type: "object",
              description: "Localized agent descriptions. Keys are locale codes.",
              additionalProperties: true,
              example: { en: "Support Agent", de: "Service-Mitarbeiterin" },
            },
            image: {
              type: "string",
              description: "Base64 encoded agent image",
            },
          },
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Agent updated successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              agent: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid", description: "Agent ID" },
                  name: { type: "string", description: "Agent name" },
                  descriptions: { type: "string", description: "Localized Agent descriptions" },
                  image: { type: "string", description: "Agent image" },
                },
                required: ["id", "name"],
              },
            },
            required: ["message", "agent"],
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

// Register OpenAPI documentation for DELETE
registerOpenAPIRoute("/tenants/{id}/agents/{agentId}", "DELETE", {
  summary: "Delete an agent",
  description:
    "Deletes an existing agent from a specific tenant. Only global admins and tenant admins can delete agents. This will also remove all channel assignments for this agent.",
  tags: ["Agents"],
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
  ],
  responses: {
    "200": {
      description: "Agent deleted successfully",
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

export const GET: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const agentId = params.agentId;

    // Check if user is authenticated
    if (!tenantId || !agentId) {
      throw new ValidationError(ERRORS.TENANTS.MISSING_TENANT_OR_AGENT_ID);
    }

    checkPermission(locals, tenantId);

    log.debug("Getting agent details", {
      tenantId,
      agentId,
      requestedBy: locals.user?.userId,
    });

    const agentService = await AgentService.forTenant(tenantId);
    const agent = await agentService.getAgentById(agentId);

    if (!agent) {
      throw new NotFoundError("Agent not found");
    }

    log.debug("Agent details retrieved successfully", {
      tenantId,
      agentId,
      requestedBy: locals.user?.userId,
    });

    return json({
      agent,
    });
  } catch (error) {
    logError(log)("Error getting agent details", error, locals.user?.userId, params.id);

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

    // Check if user is authenticated
    if (!tenantId || !agentId) {
      throw new ValidationError(ERRORS.TENANTS.MISSING_TENANT_OR_AGENT_ID);
    }

    checkPermission(locals, tenantId, true);
    const body = await request.json();

    log.debug("Updating agent", {
      tenantId,
      agentId,
      requestedBy: locals.user?.userId,
      updateFields: Object.keys(body),
    });

    const agentService = await AgentService.forTenant(tenantId);
    const updatedAgent = await agentService.updateAgent(agentId, body);

    log.debug("Agent updated successfully", {
      tenantId,
      agentId,
      requestedBy: locals.user?.userId,
    });

    return json({
      message: "Agent updated successfully",
      agent: updatedAgent,
    });
  } catch (error) {
    logError(log)("Error updating agent", error, locals.user?.userId, params.id);

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

    if (!tenantId || !agentId) {
      throw new ValidationError(ERRORS.TENANTS.MISSING_TENANT_OR_AGENT_ID);
    }

    checkPermission(locals, tenantId, true);

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const openAppointments = await appointmentService.getAppointmentsForAgent(agentId, new Date());
    if (openAppointments.length > 0) {
      throw new ConflictError(ERRORS.AGENTS.OPEN_APPOINTMENTS_CONFLICT);
    }

    log.debug("Deleting agent", {
      tenantId,
      agentId,
      requestedBy: locals.user?.userId,
    });

    const agentService = await AgentService.forTenant(tenantId);
    const deleted = await agentService.deleteAgent(agentId);

    if (!deleted) {
      throw new NotFoundError(ERRORS.AGENTS.NOT_FOUND);
    }

    log.debug("Agent deleted successfully", {
      tenantId,
      agentId,
      requestedBy: locals.user?.userId,
    });

    return json({
      message: "Agent deleted successfully",
    });
  } catch (error) {
    logError(log)("Error deleting agent", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
