import { json } from "@sveltejs/kit";
import { AppointmentService } from "$lib/server/services/appointment-service";
import {
  AuthorizationError,
  BackendError,
  InternalError,
  logError,
  NotFoundError,
  ValidationError,
} from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/appointments/{appointmentId}", "GET", {
  summary: "Get appointment by ID",
  description:
    "Retrieves a specific appointment by its ID. Accessible to dashboard users. Required for notification previews. Only returns a subset of appointment data.",
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
                  status: {
                    type: "string",
                    enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"],
                    description: "Appointment status",
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
                required: ["id", "tunnelId", "channelId", "appointmentDate", "status"],
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

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}/appointments/{appointmentId}", "PUT", {
  summary: "Update appointment",
  description: "Updates a specific appointment. Only staff members can update appointments.",
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
  requestBody: {
    description: "Properties to update",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            agentId: {
              type: "string",
              description: "ID of the agent that will conduct the appointment",
              example: "01234567-89ab-cdef-0123-456789abcdef",
            },
            appointmentDate: {
              type: "string",
              format: "date-time",
              description: "Appointment date and time (ISO 8601)",
              example: "2024-12-31T14:30:00.000Z",
            },
          },
          required: [],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Appointment updated successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              agentId: { type: "string", description: "The updated agent ID" },
              appointmentDate: {
                type: "string",
                format: "date-time",
                description: "The updated appointment date and time (ISO 8601)",
                example: "2024-12-31T14:30:00.000Z",
              },
            },
            required: [],
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
  description: "Deletes a specific appointment. Only staff members can delete appointments.",
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

    checkPermission(locals, tenantId, true);

    log.debug("Getting appointment by ID", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.id,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const appointment = await appointmentService.getAppointmentById(appointmentId);

    if (!appointment) {
      throw new NotFoundError("Appointment not found");
    }

    log.debug("Appointment retrieved successfully", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.id,
    });

    // Stripping data, because we only us this for notification previews
    return json({
      appointment: {
        id: appointment.id,
        appointmentDate: appointment.appointmentDate,
        channelId: appointment.channelId,
        agentId: appointment.agentId,
      },
    });
  } catch (error) {
    logError(log)("Error getting appointment", error, locals.user?.id, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

const requestSchema = z.object({
  // For sending change notifications
  clientEmail: z.string().optional(),
  clientLanguage: z.string().optional(),
  // Actual update data
  agentId: z.string().min(1),
  appointmentDate: z.string().min(1),
});

export const PUT: RequestHandler = async ({ params, locals, request }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const appointmentId = params.appointmentId;

    if (!tenantId || !appointmentId) {
      throw new ValidationError("Tenant ID and appointment ID are required");
    }

    checkPermission(locals, tenantId);

    // Can global Admins do this?
    const role = locals.user?.role;

    if (!role) {
      throw new AuthorizationError("Role unavailable");
    }

    if (!["TENANT_ADMIN", "STAFF"].includes(role)) {
      throw new AuthorizationError("Role not permitted to make this request");
    }

    log.debug("Updating appointment", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.id,
    });

    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      throw new ValidationError(
        "Invalid request data: " + validation.error.issues.map((e) => e.message).join(", "),
      );
    }

    const { clientEmail, clientLanguage, ...updateData } = validation.data;
    const appointmentService = await AppointmentService.forTenant(tenantId);
    const updated = await appointmentService.updateAppointmentByStaff(
      appointmentId,
      updateData,
      clientEmail,
      clientLanguage,
    );

    if (!updated) {
      return json({ error: "Appointment not found" }, { status: 404 });
    }

    log.debug("Appointment updated successfully", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.id,
    });

    return json(updated);
  } catch (error) {
    logError(log)("Error updating appointment", error, locals.user?.id, params.id);

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
      requestedBy: locals.user?.id,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const deleted = await appointmentService.deleteAppointment(appointmentId);

    if (!deleted) {
      return json({ error: "Appointment not found" }, { status: 404 });
    }

    log.debug("Appointment deleted successfully", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.id,
    });

    return json({
      message: "Appointment deleted successfully",
    });
  } catch (error) {
    logError(log)("Error deleting appointment", error, locals.user?.id, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
