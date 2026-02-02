import { json, type RequestHandler } from "@sveltejs/kit";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { z } from "zod";
import logger from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";

const requestSchema = z.object({
  clientEmail: z.string().email().optional(),
  clientLanguage: z.string().optional(),
});

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/appointments/{appointmentId}/deny", "POST", {
  summary: "Deny appointment",
  description:
    "Denies a pending appointment request. Updates the appointment status to REJECTED and sends a rejection notification email to the client.",
  tags: ["Appointments", "Staff"],
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
      description: "Appointment ID to deny",
    },
  ],
  requestBody: {
    description: "Client information for rejection email",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            clientEmail: {
              type: "string",
              format: "email",
              description: "Client email address for rejection notification",
            },
            clientLanguage: {
              type: "string",
              description: "Client preferred language (e.g., 'de', 'en')",
            },
          },
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Appointment denied successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: {
                type: "boolean",
                example: true,
              },
            },
          },
        },
      },
    },
    "400": {
      description: "Missing required parameters",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Appointment not found or in wrong state",
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

/**
 * POST /api/tenants/[id]/appointments/[appointmentId]/deny
 *
 * Denies a pending appointment request. The appointment must be in NEW status.
 * Sends a rejection email to the client and creates staff notifications.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const log = logger.setContext("API.DenyAppointment");
  const tenantId = params.id;
  const { appointmentId } = params;

  try {
    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }
    if (!appointmentId) {
      throw new ValidationError("appointmentId is required");
    }

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const body = await request.json();
    const { clientEmail, clientLanguage } = requestSchema.parse(body);

    log.info("Denying appointment", {
      tenantId,
      appointmentId,
      clientEmailPrefix: clientEmail ? clientEmail.slice(0, 3) : undefined,
    });

    await appointmentService.denyAppointment(appointmentId, clientEmail, clientLanguage);
    log.info("Appointment denied successfully", {
      tenantId,
      appointmentId,
    });
    return json({ success: true });
  } catch (error) {
    logError(log)("Error denying appointment", error);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    if (error instanceof z.ZodError) {
      return new ValidationError("Invalid request data").toJson();
    }

    return new InternalError().toJson();
  }
};
