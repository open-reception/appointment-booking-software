import { error, json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { centralDb } from "$lib/server/db";
import { tenant } from "$lib/server/db/central-schema";
import { eq } from "drizzle-orm";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import { UserService } from "$lib/server/services/user-service";
import { generateAccessToken } from "$lib/server/auth/jwt-utils";
import { UniversalLogger } from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { checkPermission } from "$lib/server/utils/permissions";

const logger = new UniversalLogger().setContext("AdminTenantSwitch");

const tenantSwitchSchema = z.object({
	tenantId: z.string().uuid()
});

/**
 * POST /api/admin/tenant
 * Switch active tenant for global admin
 */
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	try {
		// Verify user is authenticated and is global admin
		const permissionError = checkPermission(locals, null, true);
		if (permissionError) {
			return permissionError;
		}

		const body = await request.json();
		const validation = tenantSwitchSchema.safeParse(body);

		if (!validation.success) {
			logger.warn("Invalid tenant switch request", {
				userId: locals.user?.id,
				errors: validation.error.errors
			});
			throw error(400, "Invalid request body");
		}

		const { tenantId } = validation.data;

		// If tenantId is provided, verify the tenant exists
		const tenantExists = await centralDb
			.select({ id: tenant.id })
			.from(tenant)
			.where(eq(tenant.id, tenantId))
			.limit(1);

		if (tenantExists.length === 0) {
			logger.warn("Tenant not found for switching", {
				userId: locals.user?.id,
				tenantId
			});
			throw error(404, "Tenant not found");
		}

		// Current user is already authenticated via authHandle

		// Update user's active tenant in the database
		const updatedUser = await UserService.updateUser(locals.user?.userId as string, {
			tenantId: tenantId || null
		});

		if (!updatedUser) {
			logger.error("Failed to update user tenant", {
				userId: locals.user?.userId,
				tenantId
			});
			throw error(500, "Failed to update user data");
		}

		// Generate new access token with updated tenant context
		const newAccessToken = await generateAccessToken(
			updatedUser,
			(locals.user?.sessionId as string) || "temp-session"
		);

		// Set new access token cookie
		cookies.set("access_token", newAccessToken, {
			httpOnly: true,
			secure: true,
			sameSite: "strict",
			path: "/",
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		logger.info("Tenant switched successfully", {
			userId: locals.user?.userId,
			fromTenant: locals.user?.tenantId,
			toTenant: tenantId
		});

		return json({
			success: true,
			message: tenantId ? "Tenant switched successfully" : "Switched to global admin mode",
			tenantId,
			user: {
				id: updatedUser.id,
				email: updatedUser.email,
				name: updatedUser.name,
				role: updatedUser.role,
				tenantId: updatedUser.tenantId
			}
		});
	} catch (err) {
		if (err instanceof ValidationError) {
			logger.warn("Validation error in tenant switch", { error: err.message });
			throw error(400, err.message);
		}

		if (err instanceof NotFoundError) {
			logger.warn("Not found error in tenant switch", { error: err.message });
			throw error(404, err.message);
		}

		logger.error("Unexpected error in tenant switch", { error: String(err) });
		throw error(500, "Internal server error");
	}
};

// Register OpenAPI documentation
registerOpenAPIRoute("/admin/tenant", "POST", {
	summary: "Switch active tenant for global admin",
	description:
		"Allows a global admin to switch their active tenant context or return to global admin mode",
	tags: ["Admin"],
	requestBody: {
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						tenantId: {
							type: "string",
							format: "uuid",
							description: "Target tenant ID"
						}
					},
					example: {
						tenantId: "123e4567-e89b-12d3-a456-426614174000"
					}
				}
			}
		}
	},
	responses: {
		200: {
			description: "Tenant switched successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							success: { type: "boolean" },
							message: { type: "string" },
							tenantId: {
								type: "string",
								format: "uuid"
							},
							user: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid" },
									email: { type: "string", format: "email" },
									name: { type: "string" },
									role: { type: "string", enum: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"] },
									tenantId: { type: "string", format: "uuid" }
								}
							}
						}
					}
				}
			}
		},
		400: {
			description: "Invalid request body"
		},
		401: {
			description: "Authentication required"
		},
		403: {
			description: "Only global admins can switch tenants"
		},
		404: {
			description: "Tenant not found"
		},
		500: {
			description: "Internal server error"
		}
	}
});
