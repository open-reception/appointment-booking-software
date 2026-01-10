import { json } from "@sveltejs/kit";
import { NotificationService } from "$lib/server/services/notification-service";
import { ValidationError, logError, BackendError, InternalError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";
import { ERRORS } from "$lib/errors";

// Register OpenAPI documentation for DELETE
registerOpenAPIRoute("/tenants/{id}/notifications/{notificationId}", "DELETE", {
  summary: "Delete a specific notification",
  description:
    "Deletes a specific notification belonging to the authenticated staff member. Only accessible by staff and tenant admins.",
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
      name: "notificationId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Notification ID",
    },
  ],
  responses: {
    "200": {
      description: "Notification deleted successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
            },
            required: ["message"],
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
      description: "Insufficient permissions or notification belongs to another user",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Notification or tenant not found",
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

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}/notifications/{notificationId}", "PUT", {
  summary: "Mark a notification as read",
  description:
    "Marks a specific notification as read for the authenticated staff member. Only accessible by staff and tenant admins.",
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
      name: "notificationId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Notification ID",
    },
  ],
  responses: {
    "200": {
      description: "Notification marked as read successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
            },
            required: ["message"],
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
      description: "Insufficient permissions or notification belongs to another user",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Notification or tenant not found",
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

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const notificationId = params.notificationId;

    // Check if user is authenticated
    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    if (!notificationId) {
      throw new ValidationError("Notification ID is required");
    }

    checkPermission(locals, tenantId);

    if (!locals.user?.id) {
      throw new ValidationError("User ID not found");
    }

    log.debug("Deleting notification", {
      tenantId,
      staffId: locals.user.id,
      notificationId,
    });

    const notificationService = await NotificationService.forTenant(tenantId);
    await notificationService.deleteNotification(notificationId, locals.user.id);

    log.info("Notification deleted successfully", {
      tenantId,
      staffId: locals.user.id,
      notificationId,
    });

    return json({
      message: "Notification deleted successfully",
    });
  } catch (error) {
    logError(log)("Error deleting notification:", error, locals.user?.id, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

export const PUT: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const notificationId = params.notificationId;

    // Check if user is authenticated
    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    if (!notificationId) {
      throw new ValidationError("Notification ID is required");
    }

    checkPermission(locals, tenantId);

    if (!locals.user?.id) {
      throw new ValidationError("User ID not found");
    }

    log.debug("Marking notification as read", {
      tenantId,
      staffId: locals.user.id,
      notificationId,
    });

    const notificationService = await NotificationService.forTenant(tenantId);
    await notificationService.markAsRead(notificationId, locals.user.id);

    log.info("Notification marked as read successfully", {
      tenantId,
      staffId: locals.user.id,
      notificationId,
    });

    return json({
      message: "Notification marked as read successfully",
    });
  } catch (error) {
    logError(log)("Error marking notification as read:", error, locals.user?.id, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
