import { json } from "@sveltejs/kit";
import { AgentService } from "$lib/server/services/agent-service";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

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
			description: "Tenant ID"
		}
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
							example: "Support Agent"
						},
						description: {
							type: "string",
							description: "Agent description",
							example: "Handles customer support requests"
						},
						logo: {
							type: "string",
							format: "byte",
							description: "Base64 encoded agent logo"
						}
					},
					required: ["name"]
				}
			}
		}
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
									description: { type: "string", description: "Agent description" },
									logo: { type: "string", format: "byte", description: "Agent logo" }
								},
								required: ["id", "name"]
							}
						},
						required: ["message", "agent"]
					}
				}
			}
		},
		"400": {
			description: "Invalid input data",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"401": {
			description: "Authentication required",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"403": {
			description: "Insufficient permissions",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"404": {
			description: "Tenant not found",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"500": {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		}
	}
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
			description: "Tenant ID"
		}
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
										description: { type: "string", description: "Agent description" },
										logo: { type: "string", format: "byte", description: "Agent logo" }
									},
									required: ["id", "name"]
								}
							}
						},
						required: ["agents"]
					}
				}
			}
		},
		"401": {
			description: "Authentication required",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"403": {
			description: "Insufficient permissions",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"404": {
			description: "Tenant not found",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"500": {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		}
	}
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const log = logger.setContext("API");

	try {
		const tenantId = params.id;

		// Check if user is authenticated
		if (!tenantId) {
			return json({ error: "No tenant id given" }, { status: 400 });
		}

		const error = checkPermission(locals, tenantId, true);
		if (error) {
			return error;
		}

		const body = await request.json();

		log.debug("Creating new agent", {
			tenantId,
			requestedBy: locals.user?.userId,
			agentName: body.name
		});

		const agentService = await AgentService.forTenant(tenantId);
		const newAgent = await agentService.createAgent(body);

		log.debug("Agent created successfully", {
			tenantId,
			agentId: newAgent.id,
			requestedBy: locals.user?.userId
		});

		return json(
			{
				message: "Agent created successfully",
				agent: newAgent
			},
			{ status: 201 }
		);
	} catch (error) {
		log.error("Error creating agent:", JSON.stringify(error || "?"));

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		if (error instanceof NotFoundError) {
			return json({ error: "Tenant not found" }, { status: 404 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ params, locals }) => {
	const log = logger.setContext("API");

	try {
		const tenantId = params.id;

		// Check if user is authenticated
		if (!tenantId) {
			return json({ error: "No tenant id given" }, { status: 400 });
		}

		const error = checkPermission(locals, tenantId);
		if (error) {
			return error;
		}

		log.debug("Getting all agents", {
			tenantId,
			requestedBy: locals.user?.userId
		});

		const agentService = await AgentService.forTenant(tenantId);
		const agents = await agentService.getAllAgents();

		log.debug("Agents retrieved successfully", {
			tenantId,
			count: agents.length,
			requestedBy: locals.user?.userId
		});

		return json({
			agents
		});
	} catch (error) {
		log.error("Error getting agents:", JSON.stringify(error || "?"));

		if (error instanceof NotFoundError) {
			return json({ error: "Tenant not found" }, { status: 404 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};
