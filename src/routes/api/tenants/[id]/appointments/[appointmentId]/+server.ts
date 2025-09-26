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
    "Retrieves a specific appointment by its ID. Accessible to staff and tenant admins and also clients.",
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
                  tunnelId: { type: "string", format: "uuid", description: "Client tunnel ID" },
                  channelId: { type: "string", format: "uuid", description: "Channel ID" },
                  appointmentDate: {
                    type: "string",
                    format: "date-time",
                    description: "Appointment date and time",
                  },
                  expiryDate: {
                    type: "string",
                    format: "date",
                    description: "Data expiry date (nullable)",
                  },
                  status: {
                    type: "string",
                    enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"],
                    description: "Appointment status",
                  },
                  isEncrypted: {
                    type: "boolean",
                    description: "Whether appointment uses end-to-end encryption",
                  },
                  encryptedPayload: {
                    type: "string",
                    description: "Encrypted appointment data (nullable)",
                  },
                  iv: {
                    type: "string",
                    description: "Initialization vector for encryption (nullable)",
                  },
                  authTag: {
                    type: "string",
                    description: "Authentication tag for encryption (nullable)",
                  },
                  createdAt: {
                    type: "string",
                    format: "date-time",
                    description: "Creation timestamp (nullable)",
                  },
                  updatedAt: {
                    type: "string",
                    format: "date-time",
                    description: "Last update timestamp (nullable)",
                  },
                },
                required: [
                  "id",
                  "tunnelId",
                  "channelId",
                  "appointmentDate",
                  "status",
                  "isEncrypted",
                ],
              },
            },
            required: ["appointment"],
          },
        },
      },
    },
    "400": {
      description: "Invalid input data",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
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
      description: "Appointment not found",
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
  description: "Deletes a specific appointment. Only tenant admins can delete appointments.",
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
    "400": {
      description: "Invalid input data",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
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
      description: "Appointment not found",
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
