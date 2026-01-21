import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { centralDb } from "$lib/server/db";
import { tenant, userSession } from "$lib/server/db/central-schema";
import { eq } from "drizzle-orm";
import {
  BackendError,
  InternalError,
  logError,
  NotFoundError,
  ValidationError,
} from "$lib/server/utils/errors";
import { UserService } from "$lib/server/services/user-service";
import { generateAccessToken } from "$lib/server/auth/jwt-utils";
import { UniversalLogger } from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { checkPermission } from "$lib/server/utils/permissions";
import { ERRORS } from "$lib/errors";

const logger = new UniversalLogger().setContext("AdminTenantSwitch");

const tenantSwitchSchema = z.object({
  tenantId: z.string().uuid(),
});

/**
 * POST /api/admin/tenant
 * Switch active tenant for global admin
 */
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  try {
    // Verify user is authenticated and is global admin
    checkPermission(locals, null, true);

    if (!locals.user?.session.sessionId) {
      throw new ValidationError(ERRORS.SECURITY.SESSION_MISSING);
    }

    const body = await request.json();
    const validation = tenantSwitchSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Invalid tenant switch request", {
        userId: locals.user?.id,
        errors: validation.error.issues,
      });
      throw new ValidationError(ERRORS.VALIDATION.INVALID_REQUEST_BODY);
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
        tenantId,
      });
      throw new NotFoundError(ERRORS.TENANTS.NOT_FOUND);
    }

    // Current user is already authenticated via authHandle

    // Update user's active tenant in the database
    const updatedUser = await UserService.updateUser(locals.user?.id as string, {
      tenantId: tenantId || null,
    });

    if (!updatedUser) {
      logger.error("Failed to update user tenant", {
        userId: locals.user.id,
        tenantId,
      });
      throw new InternalError(ERRORS.USERS.FAILED_TO_UPDATE);
    }

    // Generate new access token with updated tenant context
    const newAccessToken = await generateAccessToken(updatedUser, locals.user.session.sessionId);

    // Update session with new access token
    await centralDb
      .update(userSession)
      .set({
        accessToken: newAccessToken,
        lastUsedAt: new Date(),
      })
      .where(eq(userSession.id, locals.user.session.sessionId));

    // Set new access token cookie
    cookies.set("access_token", newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 15,
    });

    logger.info("Tenant switched successfully", {
      userId: locals.user?.id,
      fromTenant: locals.user?.tenantId,
      toTenant: tenantId,
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
        tenantId: updatedUser.tenantId,
      },
    });
  } catch (err) {
    logError(logger)("Error in tenant switch", err, locals.user?.id);

    if (err instanceof BackendError) {
      return err.toJson();
    }
    return new InternalError().toJson();
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
              description: "Target tenant ID",
            },
          },
          example: {
            tenantId: "123e4567-e89b-12d3-a456-426614174000",
          },
        },
      },
    },
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
                format: "uuid",
              },
              user: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  email: { type: "string", format: "email" },
                  name: { type: "string" },
                  role: { type: "string", enum: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"] },
                  tenantId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
      },
    },
    400: {
      description: "Invalid request body",
    },
    401: {
      description: "Authentication required",
    },
    403: {
      description: "Only global admins can switch tenants",
    },
    404: {
      description: "Tenant not found",
    },
    500: {
      description: "Internal server error",
    },
  },
});
