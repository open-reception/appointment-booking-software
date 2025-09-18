import { json } from "@sveltejs/kit";
import { AppointmentService } from "$lib/server/services/appointment-service";
import {
  BackendError,
  InternalError,
  logError,
  NotFoundError,
  ValidationError,
} from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/appointments/{appointmentId}", "GET", {
  summary: "Get appointment by ID",
  description:
    "Retrieves a specific appointment by ID. Global admins, tenant admins, and staff can view appointments.",
  tags: ["Appointments"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "appointmentId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Appointment ID",
    },
  ],
  responses: {
    "200": {
      description: "Appointment retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              appointment: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid", description: "Appointment ID" },
                  clientId: { type: "string", format: "uuid", description: "Client ID" },
                  channelId: { type: "string", format: "uuid", description: "Channel ID" },
                  appointmentDate: {
                    type: "string",
                    format: "date-time",
                    description: "Appointment date",
                  },
                  expiryDate: { type: "string", format: "date", description: "Expiry date" },
                  title: { type: "string", description: "Appointment title" },
                  description: { type: "string", description: "Appointment description" },
                  status: {
                    type: "string",
                    enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"],
                  },
                  client: {
                    type: "object",
                    description: "Client details",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      hashKey: { type: "string" },
                      email: { type: "string" },
                    },
                  },
                  channel: {
                    type: "object",
                    description: "Channel details",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      names: { type: "array", items: { type: "string" } },
                      color: { type: "string" },
                    },
                  },
                },
                required: [
                  "id",
                  "clientId",
                  "channelId",
                  "appointmentDate",
                  "expiryDate",
                  "title",
                  "status",
                ],
              },
            },
            required: ["appointment"],
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
      description: "Tenant or appointment not found",
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
registerOpenAPIRoute("/tenants/{id}/appointments/{appointmentId}", "DELETE", {
  summary: "Delete appointment",
  description:
    "Permanently deletes an appointment. Only global admins and tenant admins can delete appointments.",
  tags: ["Appointments"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "appointmentId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Appointment ID",
    },
  ],
  responses: {
    "200": {
      description: "Appointment deleted successfully",
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
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Tenant or appointment not found",
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
    const appointmentId = params.appointmentId;

    if (!tenantId || !appointmentId) {
      throw new ValidationError("Tenant ID and appointment ID are required");
    }

    checkPermission(locals, tenantId);

    log.debug("Getting appointment by ID", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.userId,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const appointment = await appointmentService.getAppointmentById(appointmentId);

    if (!appointment) {
      throw new NotFoundError("Appointment not found");
    }

    log.debug("Appointment retrieved successfully", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.userId,
    });

    return json({
      appointment,
    });
  } catch (error) {
    logError(log)("Error getting appointment", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const appointmentId = params.appointmentId;

    if (!tenantId || !appointmentId) {
      throw new ValidationError("Tenant ID and appointment ID are required");
    }

    checkPermission(locals, tenantId, true);

    log.debug("Deleting appointment", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.userId,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const deleted = await appointmentService.deleteAppointment(appointmentId);

    if (!deleted) {
      return json({ error: "Appointment not found" }, { status: 404 });
    }

    log.debug("Appointment deleted successfully", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.userId,
    });

    return json({
      message: "Appointment deleted successfully",
    });
  } catch (error) {
    logError(log)("Error deleting appointment", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
