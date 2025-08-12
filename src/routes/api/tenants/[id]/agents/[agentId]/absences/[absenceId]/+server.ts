import { json } from "@sveltejs/kit";
import { AgentService } from "$lib/server/services/agent-service";
import { ValidationError, NotFoundError, ConflictError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

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
			name: "absenceId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "Absence ID"
		}
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
									isFullDay: { type: "boolean", description: "Full day absence" }
								},
								required: ["id", "agentId", "startDate", "endDate", "absenceType", "isFullDay"]
							}
						},
						required: ["absence"]
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
			description: "Absence, agent, or tenant not found",
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
			name: "absenceId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "Absence ID"
		}
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
							example: "Krankheit"
						},
						description: {
							type: "string",
							description: "Optional description of the absence",
							example: "Erkältung"
						},
						isFullDay: {
							type: "boolean",
							description: "Whether this is a full day absence",
							example: false
						}
					}
				}
			}
		}
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
			description: "Absence, agent, or tenant not found",
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
			name: "absenceId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "Absence ID"
		}
	],
	responses: {
		"200": {
			description: "Absence deleted successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							message: { type: "string", description: "Success message" }
						},
						required: ["message"]
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
			description: "Absence, agent, or tenant not found",
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

export const GET: RequestHandler = async ({ params, locals }) => {
	const log = logger.setContext("API");

	try {
		const tenantId = params.id;
		const agentId = params.agentId;
		const absenceId = params.absenceId;

		// Check if user is authenticated
		if (!locals.user) {
			return json({ error: "Authentication required" }, { status: 401 });
		}

		if (!tenantId || !agentId || !absenceId) {
			return json({ error: "Missing tenant, agent, or absence ID" }, { status: 400 });
		}

		// Authorization check: Global admins, tenant admins, and staff can view absences
		if (locals.user.role === "GLOBAL_ADMIN") {
			// Global admin can view absences for any tenant
		} else if ((locals.user.role === "TENANT_ADMIN" || locals.user.role === "STAFF") && locals.user.tenantId === tenantId) {
			// Tenant admin and staff can view absences for their own tenant
		} else {
			return json({ error: "Insufficient permissions" }, { status: 403 });
		}

		log.debug("Getting absence details", {
			tenantId,
			agentId,
			absenceId,
			requestedBy: locals.user.userId
		});

		const agentService = await AgentService.forTenant(tenantId);
		const absence = await agentService.getAbsenceById(absenceId);

		if (!absence) {
			return json({ error: "Absence not found" }, { status: 404 });
		}

		// Verify the absence belongs to the requested agent
		if (absence.agentId !== agentId) {
			return json({ error: "Absence not found for this agent" }, { status: 404 });
		}

		log.debug("Absence details retrieved successfully", {
			tenantId,
			agentId,
			absenceId,
			requestedBy: locals.user.userId
		});

		return json({
			absence
		});
	} catch (error) {
		log.error("Error getting absence details:", JSON.stringify(error || "?"));

		if (error instanceof NotFoundError) {
			return json({ error: "Absence not found" }, { status: 404 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const log = logger.setContext("API");

	try {
		const tenantId = params.id;
		const agentId = params.agentId;
		const absenceId = params.absenceId;

		// Check if user is authenticated
		if (!locals.user) {
			return json({ error: "Authentication required" }, { status: 401 });
		}

		if (!tenantId || !agentId || !absenceId) {
			return json({ error: "Missing tenant, agent, or absence ID" }, { status: 400 });
		}

		// Authorization check: Global admins, tenant admins, and staff can update absences
		if (locals.user.role === "GLOBAL_ADMIN") {
			// Global admin can update absences for any tenant
		} else if ((locals.user.role === "TENANT_ADMIN" || locals.user.role === "STAFF") && locals.user.tenantId === tenantId) {
			// Tenant admin and staff can update absences for their own tenant
		} else {
			return json({ error: "Insufficient permissions" }, { status: 403 });
		}

		const body = await request.json();

		log.debug("Updating agent absence", {
			tenantId,
			agentId,
			absenceId,
			requestedBy: locals.user.userId,
			updateFields: Object.keys(body)
		});

		const agentService = await AgentService.forTenant(tenantId);
		
		// First verify the absence exists and belongs to the agent
		const existingAbsence = await agentService.getAbsenceById(absenceId);
		if (!existingAbsence) {
			return json({ error: "Absence not found" }, { status: 404 });
		}

		if (existingAbsence.agentId !== agentId) {
			return json({ error: "Absence not found for this agent" }, { status: 404 });
		}

		const updatedAbsence = await agentService.updateAbsence(absenceId, body);

		log.debug("Agent absence updated successfully", {
			tenantId,
			agentId,
			absenceId,
			requestedBy: locals.user.userId
		});

		return json({
			message: "Absence updated successfully",
			absence: updatedAbsence
		});
	} catch (error) {
		log.error("Error updating agent absence:", JSON.stringify(error || "?"));

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		if (error instanceof NotFoundError) {
			return json({ error: "Absence not found" }, { status: 404 });
		}

		if (error instanceof ConflictError) {
			return json({ error: error.message }, { status: 409 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const log = logger.setContext("API");

	try {
		const tenantId = params.id;
		const agentId = params.agentId;
		const absenceId = params.absenceId;

		// Check if user is authenticated
		if (!locals.user) {
			return json({ error: "Authentication required" }, { status: 401 });
		}

		if (!tenantId || !agentId || !absenceId) {
			return json({ error: "Missing tenant, agent, or absence ID" }, { status: 400 });
		}

		// Authorization check: Global admins, tenant admins, and staff can delete absences
		if (locals.user.role === "GLOBAL_ADMIN") {
			// Global admin can delete absences for any tenant
		} else if ((locals.user.role === "TENANT_ADMIN" || locals.user.role === "STAFF") && locals.user.tenantId === tenantId) {
			// Tenant admin and staff can delete absences for their own tenant
		} else {
			return json({ error: "Insufficient permissions" }, { status: 403 });
		}

		log.debug("Deleting agent absence", {
			tenantId,
			agentId,
			absenceId,
			requestedBy: locals.user.userId
		});

		const agentService = await AgentService.forTenant(tenantId);
		
		// First verify the absence exists and belongs to the agent
		const existingAbsence = await agentService.getAbsenceById(absenceId);
		if (!existingAbsence) {
			return json({ error: "Absence not found" }, { status: 404 });
		}

		if (existingAbsence.agentId !== agentId) {
			return json({ error: "Absence not found for this agent" }, { status: 404 });
		}

		const deleted = await agentService.deleteAbsence(absenceId);

		if (!deleted) {
			return json({ error: "Absence not found" }, { status: 404 });
		}

		log.debug("Agent absence deleted successfully", {
			tenantId,
			agentId,
			absenceId,
			requestedBy: locals.user.userId
		});

		return json({
			message: "Absence deleted successfully"
		});
	} catch (error) {
		log.error("Error deleting agent absence:", JSON.stringify(error || "?"));

		if (error instanceof NotFoundError) {
			return json({ error: "Absence not found" }, { status: 404 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};