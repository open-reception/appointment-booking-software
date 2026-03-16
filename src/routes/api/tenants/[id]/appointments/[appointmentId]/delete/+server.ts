import { json } from "@sveltejs/kit";
import { z } from "zod";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

const requestSchema = z.object({
  clientEmail: z.email().optional(),
  clientLanguage: z.string().optional().default("en"),
});

// Register OpenAPI documentation for DELETE
registerOpenAPIRoute("/tenants/{id}/appointments/{appointmentId}", "DELETE", {
  summary: "Delete appointment",
  description:
    "Deletes an appointment, removing it from the database, sending a cancellation email to the client, and creating notifications for channel staff. Accessible to staff and tenant admins.",
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
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            clientEmail: {
              type: "string",
              format: "email",
              description: "Email address of the client",
              example: "client@example.com",
            },
            clientLanguage: {
              type: "string",
              description: "Client's preferred language for the cancellation email",
              default: "de",
              example: "de",
            },
          },
          required: ["clientEmail"],
        },
      },
    },
  },
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

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const appointmentId = params.appointmentId;

    // Check if user is authenticated
    if (!tenantId || !appointmentId) {
      throw new ValidationError("Tenant ID and appointment ID are required");
    }

    checkPermission(locals, tenantId);

    // Parse request body
    const body = await request.json();
    const validationResult = requestSchema.safeParse(body);

    if (!validationResult.success) {
      throw new ValidationError("Invalid request body");
    }

    const { clientEmail, clientLanguage } = validationResult.data;

    log.debug("Deleting appointment", {
      tenantId,
      appointmentId,
      clientEmail,
      requestedBy: locals.user?.id,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    await appointmentService.deleteAppointmentByStaff(appointmentId, clientEmail, clientLanguage);

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
