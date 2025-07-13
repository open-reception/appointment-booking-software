import { json } from "@sveltejs/kit";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}", "PUT", {
	summary: "Update tenant metadata",
	description:
		"Updates the metadata for a specific tenant (longName, shortName, description, logo)",
	tags: ["Tenants"],
	parameters: [
		{
			name: "id",
			in: "path",
			required: true,
			schema: { type: "string" },
			description: "Tenant ID"
		}
	],
	requestBody: {
		description: "Tenant metadata updates",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						longName: {
							type: "string",
							description: "Full name of the tenant organization",
							example: "ACME Corporation"
						},
						shortName: {
							type: "string",
							minLength: 4,
							maxLength: 15,
							description: "Short name for the tenant (4-15 characters)",
							example: "acme-corp"
						},
						description: {
							type: "string",
							description: "Description of the tenant organization",
							example: "Leading provider of innovative solutions"
						},
						logo: {
							type: "string",
							description: "URL or base64 encoded logo image",
							example: "https://example.com/logo.png"
						}
					}
				}
			}
		}
	},
	responses: {
		"200": {
			description: "Tenant metadata updated successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							message: { type: "string", description: "Success message" },
							tenant: {
								type: "object",
								properties: {
									id: { type: "string", description: "Tenant ID" },
									shortName: { type: "string", description: "Short name" },
									longName: { type: "string", description: "Long name" },
									description: { type: "string", description: "Description" },
									logo: { type: "string", description: "Logo URL" },
									updatedAt: {
										type: "string",
										format: "date-time",
										description: "Last update timestamp"
									}
								}
							}
						},
						required: ["message", "tenant"]
					},
					example: {
						message: "Tenant metadata updated successfully",
						tenant: {
							id: "01234567-89ab-cdef-0123-456789abcdef",
							shortName: "acme-corp",
							longName: "ACME Corporation",
							description: "Leading provider of innovative solutions",
							logo: "https://example.com/logo.png",
							updatedAt: "2024-01-01T12:00:00Z"
						}
					}
				}
			}
		},
		"400": {
			description: "Invalid input data",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "Invalid tenant data" }
				}
			}
		},
		"404": {
			description: "Tenant not found",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "Tenant not found" }
				}
			}
		},
		"409": {
			description: "Short name already exists",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" },
					example: { error: "A tenant with this short name already exists" }
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

export const PUT: RequestHandler = async ({ params, request }) => {
	const log = logger.setContext("API");

	try {
		const tenantId = params.id;
		const body = await request.json();

		log.debug("Updating tenant metadata", {
			tenantId,
			updateFields: Object.keys(body)
		});

		if (!tenantId) {
			return json({ error: "No tenant id given" }, { status: 400 });
		}

		const tenantService = await TenantAdminService.getTenantById(tenantId);
		const updatedTenant = await tenantService.updateTenantData(body);

		log.debug("Tenant metadata updated successfully", {
			tenantId,
			updateFields: Object.keys(body)
		});

		return json({
			message: "Tenant metadata updated successfully",
			tenant: updatedTenant
		});
	} catch (error) {
		log.error("Error updating tenant metadata:", JSON.stringify(error || "?"));

		if (error instanceof ValidationError) {
			return json({ error: error.message }, { status: 400 });
		}

		if (error instanceof NotFoundError) {
			return json({ error: "Tenant not found" }, { status: 404 });
		}

		// Handle unique constraint violation (shortName already exists)
		if (error instanceof Error && error.message.includes("unique constraint")) {
			return json({ error: "A tenant with this short name already exists" }, { status: 409 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};
