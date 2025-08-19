import { json } from "@sveltejs/kit";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { db } from "$lib/server/db";
import { tenant } from "$lib/server/db/central-schema";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

// Register OpenAPI documentation
registerOpenAPIRoute("/tenants", "POST", {
	summary: "Create a new tenant",
	description: "Creates a new tenant with initial configuration",
	tags: ["Tenants"],
	requestBody: {
		description: "Tenant creation data",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						shortName: {
							type: "string",
							minLength: 4,
							maxLength: 15,
							description: "Short name for the tenant (4-15 characters)",
							example: "acme-corp"
						},
						inviteAdmin: {
							type: "string",
							format: "email",
							description: "Email address to invite as tenant admin",
							example: "admin@acme-corp.com"
						}
					},
					required: ["shortName"]
				}
			}
		}
	},
	responses: {
		"201": {
			description: "Tenant created successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							message: { type: "string", description: "Success message" },
							tenantId: { type: "string", description: "Generated tenant ID" },
							shortName: { type: "string", description: "Tenant short name" }
						},
						required: ["message", "tenantId", "shortName"]
					},
					example: {
						message: "Tenant created successfully",
						tenantId: "01234567-89ab-cdef-0123-456789abcdef",
						shortName: "acme-corp"
					}
				}
			}
		},
		"400": {
			description: "Invalid input data",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "Invalid tenant creation request" }
				}
			}
		},
		"500": {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "Internal server error" }
				}
			}
		}
	}
});

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants", "GET", {
	summary: "Get all tenant IDs",
	description: "Returns a list of all tenant IDs and basic information",
	tags: ["Tenants"],
	responses: {
		"200": {
			description: "List of all tenants",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							tenants: {
								type: "array",
								items: {
									type: "object",
									properties: {
										id: { type: "string", format: "uuid", description: "Tenant ID" },
										shortName: { type: "string", description: "Tenant short name" },
										longName: { type: "string", description: "Tenant long name" },
										setupState: {
											type: "string",
											enum: ["NEW", "SETTINGS_CREATED", "AGENTS_SET_UP", "FIRST_CHANNEL_CREATED"],
											description: "Current setup state"
										}
									},
									required: ["id", "shortName", "setupState"]
								}
							}
						},
						required: ["tenants"]
					},
					example: {
						tenants: [
							{
								id: "01234567-89ab-cdef-0123-456789abcdef",
								shortName: "acme-corp",
								longName: "ACME Corporation",
								setupState: "FIRST_CHANNEL_CREATED"
							}
						]
					}
				}
			}
		},
		"403": {
			description: "Insufficient permissions (Global Admin required)",
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

export const POST: RequestHandler = async ({ locals, request }) => {
	const log = logger.setContext("API");

	try {
		const body = await request.json();

		log.debug("Creating tenant", {
			shortName: body.shortName,
			hasInviteAdmin: !!body.inviteAdmin
		});

		const error = checkPermission(locals, null, true);
		if (error) {
			return error;
		}

		const tenantService = await TenantAdminService.createTenant({
			shortName: body.shortName,
			inviteAdmin: body.inviteAdmin
		});

		log.debug("Tenant created successfully", {
			tenantId: tenantService.tenantId,
			shortName: body.shortName
		});

		return json(
			{
				message: "Tenant created successfully",
				tenantId: tenantService.tenantId,
				shortName: body.shortName
			},
			{ status: 201 }
		);
	} catch (error) {
		log.error("Tenant creation error:", JSON.stringify(error || "?"));

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		// Handle unique constraint violation (shortName already exists)
		if (error instanceof Error && error.message.includes("unique constraint")) {
			return json({ error: "A tenant with this short name already exists" }, { status: 409 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};

export const GET: RequestHandler = async ({ locals }) => {
	const log = logger.setContext("API");

	try {
		// Check if user is authenticated and is a global admin
		if (!locals.user) {
			return json({ error: "Authentication required" }, { status: 401 });
		}

		if (locals.user.role !== "GLOBAL_ADMIN") {
			return json({ error: "Global admin access required" }, { status: 403 });
		}

		log.debug("Getting all tenants", {
			requestedBy: locals.user.userId
		});

		// Get all tenants from database
		const tenants = await db
			.select({
				id: tenant.id,
				shortName: tenant.shortName,
				longName: tenant.longName,
				setupState: tenant.setupState
			})
			.from(tenant)
			.orderBy(tenant.shortName);

		log.debug("Retrieved tenants successfully", {
			tenantCount: tenants.length,
			requestedBy: locals.user.userId
		});

		return json({
			tenants: tenants
		});
	} catch (error) {
		log.error("Failed to get tenants:", JSON.stringify(error || "?"));
		return json({ error: "Internal server error" }, { status: 500 });
	}
};
