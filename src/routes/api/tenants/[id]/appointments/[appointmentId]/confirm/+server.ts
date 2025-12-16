import { json } from "@sveltejs/kit";
import { z } from "zod";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

const requestSchema = z.object({
  clientEmail: z.string().email().optional(),
  clientLanguage: z.string().optional().default("de"),
});

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
  requestBody: {
    description: "Optional client email and language for sending confirmation email",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            clientEmail: {
              type: "string",
              format: "email",
              description:
                "Client email address (required for sending confirmation email after staff confirmation)",
              example: "client@example.com",
            },
            clientLanguage: {
              type: "string",
              description: "Client's preferred language (de or en)",
              example: "de",
              default: "de",
            },
          },
        },
      },
    },
  },
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

export const PUT: RequestHandler = async ({ request, params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const appointmentId = params.appointmentId;

    if (!tenantId || !appointmentId) {
      throw new ValidationError("Tenant ID and appointment ID are required");
    }

    checkPermission(locals, tenantId);

    // Parse optional request body for email notification
    let clientEmail: string | undefined;
    let clientLanguage = "de";

    try {
      const body = await request.json();
      const validatedData = requestSchema.parse(body);
      clientEmail = validatedData.clientEmail;
      clientLanguage = validatedData.clientLanguage;
    } catch {
      // Body is optional, so ignore parsing errors
      log.debug("No valid request body provided for confirmation email", {
        tenantId,
        appointmentId,
      });
    }

    log.debug("Confirming appointment", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.id,
      willSendEmail: !!clientEmail,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const confirmedAppointment = await appointmentService.confirmAppointment(
      appointmentId,
      clientEmail,
      clientLanguage,
    );

    log.debug("Appointment confirmed successfully", {
      tenantId,
      appointmentId,
      requestedBy: locals.user?.id,
    });

    return json({
      message: "Appointment confirmed successfully",
      appointment: confirmedAppointment,
    });
  } catch (error) {
    logError(log)("Error confirming appointment", error, locals.user?.id, params.id);
    if (error instanceof BackendError) {
      return error.toJson();
    }
    return new InternalError().toJson();
  }
};
