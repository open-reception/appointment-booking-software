import { json } from "@sveltejs/kit";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}/appointments/{appointmentId}/confirm", "PUT", {
  summary: "Confirm appointment",
  description:
    "Confirms a pending appointment, changing its status from NEW to CONFIRMED. Accessible to staff and tenant admins.",
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
      description: "Appointment confirmed successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
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
                    enum: ["CONFIRMED"],
                    description:
                      "Appointment status (will be CONFIRMED after successful operation)",
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
            required: ["message", "appointment"],
          },
        },
      },
    },
    "400": {
      description: "Invalid input data or appointment not in NEW status",
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

export const PUT: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const appointmentId = params.appointmentId;

    if (!tenantId || !appointmentId) {
      throw new ValidationError("Tenant ID and appointment ID are required");
    }

    checkPermission(locals, tenantId);

    log.debug("Confirming appointment", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.userId,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const confirmedAppointment = await appointmentService.confirmAppointment(appointmentId);

    log.debug("Appointment confirmed successfully", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.userId,
    });

    return json({
      message: "Appointment confirmed successfully",
      appointment: confirmedAppointment,
    });
  } catch (error) {
    logError(log)("Error confirming appointment", error, locals.user?.userId, params.id);
    if (error instanceof BackendError) {
      return error.toJson();
    }
    return new InternalError().toJson();
  }
};
