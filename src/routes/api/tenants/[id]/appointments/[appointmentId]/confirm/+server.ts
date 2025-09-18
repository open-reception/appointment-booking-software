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
    "Confirms an appointment by setting its status to CONFIRMED. Global admins, tenant admins, and staff can confirm appointments.",
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
            required: ["message", "appointment"],
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
