import { json } from "@sveltejs/kit";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

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

export const POST: RequestHandler = async ({ request }) => {
	const log = logger.setContext("API");

	try {
		const body = await request.json();

		log.debug("Creating tenant", {
			shortName: body.shortName,
			hasInviteAdmin: !!body.inviteAdmin
		});

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
