import { json } from "@sveltejs/kit";
import { AgentService } from "$lib/server/services/agent-service";
import { ValidationError, NotFoundError, ConflictError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/agents/{agentId}/absences", "POST", {
	summary: "Create agent absence",
	description:
		"Creates a new absence period for an agent. Global admins, tenant admins, and staff can create absences.",
	tags: ["Agent Absences"],
	parameters: [
		{
			name: "id",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "Tenant ID"
		},
		{
			name: "agentId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "Agent ID"
		}
	],
	requestBody: {
		description: "Absence creation data",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						startDate: {
							type: "string",
							format: "date-time",
							description: "Start date and time of absence",
							example: "2024-01-15T00:00:00.000Z"
						},
						endDate: {
							type: "string",
							format: "date-time",
							description: "End date and time of absence",
							example: "2024-01-17T23:59:59.999Z"
						},
						absenceType: {
							type: "string",
							maxLength: 100,
							description: "Type of absence (free text)",
							example: "Urlaub"
						},
						description: {
							type: "string",
							description: "Optional description of the absence",
							example: "Jahresurlaub"
						},
						isFullDay: {
							type: "boolean",
							description: "Whether this is a full day absence",
							example: true,
							default: true
						}
					},
					required: ["startDate", "endDate", "absenceType"]
				}
			}
		}
	},
	responses: {
		"201": {
			description: "Absence created successfully",
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
									isFullDay: { type: "boolean", description: "Full day absence" }
								},
								required: ["id", "agentId", "startDate", "endDate", "absenceType", "isFullDay"]
							}
						},
						required: ["message", "absence"]
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
			description: "Agent or tenant not found",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"409": {
			description: "Absence period overlaps with existing absence",
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
registerOpenAPIRoute("/tenants/{id}/agents/{agentId}/absences", "GET", {
	summary: "Get agent absences",
	description:
		"Retrieves all absences for a specific agent. Global admins, tenant admins, and staff can view absences.",
	tags: ["Agent Absences"],
	parameters: [
		{
			name: "id",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "Tenant ID"
		},
		{
			name: "agentId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "Agent ID"
		},
		{
			name: "startDate",
			in: "query",
			required: false,
			schema: { type: "string", format: "date-time" },
			description: "Filter absences starting from this date"
		},
		{
			name: "endDate",
			in: "query",
			required: false,
			schema: { type: "string", format: "date-time" },
			description: "Filter absences ending before this date"
		}
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
										isFullDay: { type: "boolean", description: "Full day absence" }
									},
									required: ["id", "agentId", "startDate", "endDate", "absenceType", "isFullDay"]
								}
							}
						},
						required: ["absences"]
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
			description: "Agent or tenant not found",
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

export const POST: RequestHandler = async ({ params, request, locals, url }) => {
	const log = logger.setContext("API");

	try {
		const tenantId = params.id;
		const agentId = params.agentId;

		// Check if user is authenticated
		if (!locals.user) {
			return json({ error: "Authentication required" }, { status: 401 });
		}

		if (!tenantId || !agentId) {
			return json({ error: "Missing tenant or agent ID" }, { status: 400 });
		}

		// Authorization check: Global admins, tenant admins, and staff can create absences
		if (locals.user.role === "GLOBAL_ADMIN") {
			// Global admin can create absences for any tenant
		} else if (
			(locals.user.role === "TENANT_ADMIN" || locals.user.role === "STAFF") &&
			locals.user.tenantId === tenantId
		) {
			// Tenant admin and staff can create absences for their own tenant
		} else {
			return json({ error: "Insufficient permissions" }, { status: 403 });
		}

		const body = await request.json();

		// Add agentId to the request body
		const absenceRequest = {
			...body,
			agentId
		};

		log.debug("Creating agent absence", {
			tenantId,
			agentId,
			requestedBy: locals.user.userId,
			absenceType: body.absenceType,
			startDate: body.startDate,
			endDate: body.endDate
		});

		const agentService = await AgentService.forTenant(tenantId);
		const newAbsence = await agentService.createAbsence(absenceRequest);

		log.debug("Agent absence created successfully", {
			tenantId,
			agentId,
			absenceId: newAbsence.id,
			requestedBy: locals.user.userId
		});

		return json(
			{
				message: "Absence created successfully",
				absence: newAbsence
			},
			{ status: 201 }
		);
	} catch (error) {
		log.error("Error creating agent absence:", JSON.stringify(error || "?"));

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		if (error instanceof NotFoundError) {
			return json({ error: "Agent not found" }, { status: 404 });
		}

		if (error instanceof ConflictError) {
			return json({ error: error.message }, { status: 409 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const log = logger.setContext("API");

	try {
		const tenantId = params.id;
		const agentId = params.agentId;

		// Check if user is authenticated
		if (!locals.user) {
			return json({ error: "Authentication required" }, { status: 401 });
		}

		if (!tenantId || !agentId) {
			return json({ error: "Missing tenant or agent ID" }, { status: 400 });
		}

		// Authorization check: Global admins, tenant admins, and staff can view absences
		if (locals.user.role === "GLOBAL_ADMIN") {
			// Global admin can view absences for any tenant
		} else if (
			(locals.user.role === "TENANT_ADMIN" || locals.user.role === "STAFF") &&
			locals.user.tenantId === tenantId
		) {
			// Tenant admin and staff can view absences for their own tenant
		} else {
			return json({ error: "Insufficient permissions" }, { status: 403 });
		}

		// Get optional query parameters for date filtering
		const startDate = url.searchParams.get("startDate");
		const endDate = url.searchParams.get("endDate");

		log.debug("Getting agent absences", {
			tenantId,
			agentId,
			requestedBy: locals.user.userId,
			startDate,
			endDate
		});

		const agentService = await AgentService.forTenant(tenantId);
		const absences = await agentService.getAgentAbsences(
			agentId,
			startDate || undefined,
			endDate || undefined
		);

		log.debug("Agent absences retrieved successfully", {
			tenantId,
			agentId,
			count: absences.length,
			requestedBy: locals.user.userId
		});

		return json({
			absences
		});
	} catch (error) {
		log.error("Error getting agent absences:", JSON.stringify(error || "?"));

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		if (error instanceof NotFoundError) {
			return json({ error: "Agent not found" }, { status: 404 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};
