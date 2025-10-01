import { json } from "@sveltejs/kit";
import { AgentService } from "$lib/server/services/agent-service";
import { ValidationError, logError, BackendError, InternalError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";
import { ERRORS } from "$lib/errors";

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/agents", "POST", {
  summary: "Create a new agent",
  description:
    "Creates a new agent for a specific tenant. Only global admins and tenant admins can create agents.",
  tags: ["Agents"],
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
    description: "Agent creation data",
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
              example: "Support Agent",
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
          required: ["name"],
        },
      },
    },
  },
  responses: {
    "201": {
      description: "Agent created successfully",
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
                  descriptions: { type: "object", description: "Localized Agent descriptions" },
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
registerOpenAPIRoute("/tenants/{id}/agents", "GET", {
  summary: "List all agents",
  description:
    "Retrieves all agents for a specific tenant. Global admins, tenant admins, and staff can view agents.",
  tags: ["Agents"],
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
      description: "Agents retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              agents: {
                type: "array",
                items: {
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
            },
            required: ["agents"],
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

    // Check if user is authenticated
    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    checkPermission(locals, tenantId, true);

    const body = await request.json();

    log.debug("Creating new agent", {
      tenantId,
      requestedBy: locals.user?.userId,
      agentName: body.name,
    });

    const agentService = await AgentService.forTenant(tenantId);
    const newAgent = await agentService.createAgent(body);

    log.debug("Agent created successfully", {
      tenantId,
      agentId: newAgent.id,
      requestedBy: locals.user?.userId,
    });

    return json(
      {
        message: "Agent created successfully",
        agent: newAgent,
      },
      { status: 201 },
    );
  } catch (error) {
    logError(log)("Error creating agent:", error, locals.user?.userId, params.id);

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

    // Check if user is authenticated
    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    checkPermission(locals, tenantId);

    log.debug("Getting all agents", {
      tenantId,
      requestedBy: locals.user?.userId,
    });

    const agentService = await AgentService.forTenant(tenantId);
    const agents = await agentService.getAllAgents();

    log.debug("Agents retrieved successfully", {
      tenantId,
      count: agents.length,
      requestedBy: locals.user?.userId,
    });

    return json({
      agents,
    });
  } catch (error) {
    logError(log)("Error getting agents:", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
