import { json } from "@sveltejs/kit";
import { AgentService } from "$lib/server/services/agent-service";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

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
                  description: { type: "string", description: "Agent description" },
                  logo: { type: "string", format: "byte", description: "Agent logo" },
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
            description: {
              type: "string",
              description: "Agent description",
              example: "Updated description for customer support",
            },
            logo: {
              type: "string",
              format: "byte",
              description: "Base64 encoded agent logo",
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
                  description: { type: "string", description: "Agent description" },
                  logo: { type: "string", format: "byte", description: "Agent logo" },
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
      return json({ error: "Missing tenant or agent ID" }, { status: 400 });
    }

    const error = checkPermission(locals, tenantId);
    if (error) {
      return error;
    }

    log.debug("Getting agent details", {
      tenantId,
      agentId,
      requestedBy: locals.user?.userId,
    });

    const agentService = await AgentService.forTenant(tenantId);
    const agent = await agentService.getAgentById(agentId);

    if (!agent) {
      return json({ error: "Agent not found" }, { status: 404 });
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
    log.error("Error getting agent details:", JSON.stringify(error || "?"));

    if (error instanceof NotFoundError) {
      return json({ error: "Agent not found" }, { status: 404 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const agentId = params.agentId;

    // Check if user is authenticated
    if (!tenantId || !agentId) {
      return json({ error: "Missing tenant or agent ID" }, { status: 400 });
    }

    const error = checkPermission(locals, tenantId, true);
    if (error) {
      return error;
    }

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
    log.error("Error updating agent:", JSON.stringify(error || "?"));

    if (error instanceof ValidationError) {
      return json({ error: error.message }, { status: 400 });
    }

    if (error instanceof NotFoundError) {
      return json({ error: "Agent not found" }, { status: 404 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const agentId = params.agentId;

    if (!tenantId || !agentId) {
      return json({ error: "Missing tenant or agent ID" }, { status: 400 });
    }

    const error = checkPermission(locals, tenantId, true);
    if (error) {
      return error;
    }

    log.debug("Deleting agent", {
      tenantId,
      agentId,
      requestedBy: locals.user?.userId,
    });

    const agentService = await AgentService.forTenant(tenantId);
    const deleted = await agentService.deleteAgent(agentId);

    if (!deleted) {
      return json({ error: "Agent not found" }, { status: 404 });
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
    log.error("Error deleting agent:", JSON.stringify(error || "?"));

    if (error instanceof NotFoundError) {
      return json({ error: "Agent not found" }, { status: 404 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};
