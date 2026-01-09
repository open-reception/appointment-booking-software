import { json } from "@sveltejs/kit";
import { NotificationService } from "$lib/server/services/notification-service";
import { ValidationError, logError, BackendError, InternalError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";
import { ERRORS } from "$lib/errors";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/notifications/unread", "GET", {
  summary: "Check if staff member has unread notifications",
  description:
    "Checks whether the authenticated staff member has any unread notifications. Only accessible by staff and tenant admins.",
  tags: ["Notifications"],
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
      description: "Unread status retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              hasUnread: {
                type: "boolean",
                description: "Whether the staff member has unread notifications",
              },
            },
            required: ["hasUnread"],
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

export const GET: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;

    // Check if user is authenticated
    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    checkPermission(locals, tenantId);

    if (!locals.user?.id) {
      throw new ValidationError("User ID not found");
    }

    log.debug("Checking for unread notifications", {
      tenantId,
      staffId: locals.user.id,
    });

    const notificationService = await NotificationService.forTenant(tenantId);
    const hasUnread = await notificationService.hasUnreadNotifications(locals.user.id);

    log.debug("Unread notification status retrieved", {
      tenantId,
      staffId: locals.user.id,
      hasUnread,
    });

    return json({
      hasUnread,
    });
  } catch (error) {
    logError(log)("Error checking unread notifications:", error, locals.user?.id, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
