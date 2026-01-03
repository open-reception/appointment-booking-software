import { json } from "@sveltejs/kit";
import { NotificationService } from "$lib/server/services/notification-service";
import { ValidationError, logError, BackendError, InternalError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";
import { ERRORS } from "$lib/errors";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/notifications", "GET", {
  summary: "List all notifications for current staff member",
  description:
    "Retrieves all notifications for the authenticated staff member. Only accessible by staff and tenant admins.",
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
      description: "Notifications retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              notifications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid", description: "Notification ID" },
                    staffId: { type: "string", format: "uuid", description: "Staff member ID" },
                    title: {
                      type: "object",
                      description: "Notification titles",
                    },
                    description: {
                      type: "object",
                      description: "Notification descriptions",
                    },
                    isRead: { type: "boolean", description: "Whether notification has been read" },
                  },
                  required: ["id", "staffId", "title", "description", "isRead"],
                },
              },
            },
            required: ["notifications"],
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

// Register OpenAPI documentation for DELETE
registerOpenAPIRoute("/tenants/{id}/notifications", "DELETE", {
  summary: "Delete all notifications for current staff member",
  description:
    "Deletes all notifications for the authenticated staff member. Optionally delete only read notifications. Only accessible by staff and tenant admins.",
  tags: ["Notifications"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "readOnly",
      in: "query",
      required: false,
      schema: { type: "boolean" },
      description: "If true, only delete read notifications",
    },
  ],
  responses: {
    "200": {
      description: "Notifications deleted successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              deletedCount: { type: "number", description: "Number of deleted notifications" },
            },
            required: ["message", "deletedCount"],
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

    log.debug("Getting all notifications", {
      tenantId,
      staffId: locals.user.id,
    });

    const notificationService = await NotificationService.forTenant(tenantId);
    const notifications = await notificationService.getNotificationsForStaff(locals.user.id);

    log.debug("Notifications retrieved successfully", {
      tenantId,
      staffId: locals.user.id,
      count: notifications.length,
    });

    return json({
      notifications,
    });
  } catch (error) {
    logError(log)("Error getting notifications:", error, locals.user?.id, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

export const DELETE: RequestHandler = async ({ params, url, locals }) => {
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

    const readOnly = url.searchParams.get("readOnly") === "true";

    log.debug("Deleting all notifications", {
      tenantId,
      staffId: locals.user.id,
      readOnly,
    });

    const notificationService = await NotificationService.forTenant(tenantId);
    const deletedCount = await notificationService.deleteAllNotifications(locals.user.id, readOnly);

    log.info("Notifications deleted successfully", {
      tenantId,
      staffId: locals.user.id,
      deletedCount,
      readOnly,
    });

    return json({
      message: "Notifications deleted successfully",
      deletedCount,
    });
  } catch (error) {
    logError(log)("Error deleting notifications:", error, locals.user?.id, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
