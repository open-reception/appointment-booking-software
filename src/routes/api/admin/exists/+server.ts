import { json } from "@sveltejs/kit";
import { AdminAccountService } from "$lib/server/services/admin-account-service";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation
registerOpenAPIRoute("/admin/exists", "GET", {
	summary: "Check if global admin exists",
	description: "Checks whether any global administrator account exists in the system. Used by frontend to determine available authentication routes.",
	tags: ["Admin"],
	responses: {
		"200": {
			description: "Admin existence status retrieved successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							exists: { 
								type: "boolean", 
								description: "Whether at least one global admin exists" 
							},
							count: { 
								type: "integer", 
								description: "Total number of global admins" 
							}
						},
						required: ["exists", "count"]
					},
					examples: {
						"admin-exists": {
							summary: "Admin exists",
							value: {
								exists: true,
								count: 2
							}
						},
						"no-admin": {
							summary: "No admin exists",
							value: {
								exists: false,
								count: 0
							}
						}
					}
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

export const GET: RequestHandler = async () => {
	const log = logger.setContext("API");
	
	try {
		log.debug("Checking if global admin exists");

		const adminExists = await AdminAccountService.adminExists();
		const adminCount = await AdminAccountService.getAdminCount();

		log.debug("Admin existence check completed", { 
			exists: adminExists, 
			count: adminCount 
		});

		return json({
			exists: adminExists,
			count: adminCount
		});
	} catch (error) {
		log.error("Error checking admin existence:", String(error));
		return json({ error: "Internal server error" }, { status: 500 });
	}
};