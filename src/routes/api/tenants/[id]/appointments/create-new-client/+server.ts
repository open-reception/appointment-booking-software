import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";

const requestSchema = z.object({
  tunnelId: z.string(),
  channelId: z.string(),
  agentId: z.string(),
  appointmentDate: z.string(),
  duration: z.number().int().positive(),
  emailHash: z.string(),
  clientEmail: z.string().email(),
  clientLanguage: z.string().optional().default("de"),
  clientPublicKey: z.string(),
  privateKeyShare: z.string(),
  encryptedAppointment: z.object({
    encryptedPayload: z.string(),
    iv: z.string(),
    authTag: z.string(),
  }),
  staffKeyShares: z.array(
    z.object({
      userId: z.string(),
      encryptedTunnelKey: z.string(),
    }),
  ),
  clientEncryptedTunnelKey: z.string(),
});

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/appointments/create-new-client", "POST", {
  summary: "Create new client with appointment",
  description:
    "Creates a new client appointment tunnel with encrypted appointment data. This handles the complete setup for new clients including tunnel creation and their first appointment.",
  tags: ["Appointments", "Clients"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
  ],
  requestBody: {
    description: "New client appointment data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            tunnelId: {
              type: "string",
              format: "uuid",
              description: "Client tunnel identifier",
            },
            channelId: {
              type: "string",
              format: "uuid",
              description: "Channel ID for the appointment",
            },
            appointmentDate: {
              type: "string",
              format: "date-time",
              description: "Appointment date and time (ISO 8601)",
            },
            emailHash: {
              type: "string",
              description: "SHA-256 hash of client email",
            },
            clientEmail: {
              type: "string",
              format: "email",
              description: "Client email address for sending confirmation",
              example: "client@example.com",
            },
            clientLanguage: {
              type: "string",
              description: "Client's preferred language (de or en)",
              example: "de",
              default: "de",
            },
            clientPublicKey: {
              type: "string",
              description: "Client's ML-KEM-768 public key (hex encoded)",
            },
            privateKeyShare: {
              type: "string",
              description: "Server-stored share of client's private key",
            },
            encryptedAppointment: {
              type: "object",
              properties: {
                encryptedPayload: {
                  type: "string",
                  description: "AES-encrypted appointment data",
                },
                iv: {
                  type: "string",
                  description: "Initialization vector for encryption",
                },
                authTag: {
                  type: "string",
                  description: "Authentication tag for AES-GCM",
                },
              },
              required: ["encryptedPayload", "iv", "authTag"],
            },
            staffKeyShares: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  userId: {
                    type: "string",
                    format: "uuid",
                    description: "Staff member's user ID",
                  },
                  encryptedTunnelKey: {
                    type: "string",
                    description: "Tunnel key encrypted with staff member's public key",
                  },
                },
                required: ["userId", "encryptedTunnelKey"],
              },
              description: "Tunnel key shares for staff members",
            },
            clientEncryptedTunnelKey: {
              type: "string",
              description: "Tunnel key encrypted with client's public key",
            },
          },
          required: [
            "tunnelId",
            "channelId",
            "appointmentDate",
            "emailHash",
            "clientEmail",
            "clientPublicKey",
            "privateKeyShare",
            "encryptedAppointment",
            "staffKeyShares",
            "clientEncryptedTunnelKey",
          ],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Client and appointment created successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
                description: "Created appointment ID",
              },
              appointmentDate: {
                type: "string",
                format: "date-time",
                description: "Appointment date and time",
              },
              status: {
                type: "string",
                enum: ["NEW", "CONFIRMED"],
                description: "Initial appointment status (depends on channel configuration)",
              },
            },
            required: ["id", "appointmentDate", "status"],
          },
        },
      },
    },
    "400": {
      description: "Invalid request data",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Channel not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "409": {
      description: "No authorized users in tenant - cannot create client appointments",
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
 * POST /api/tenants/[id]/appointments/create-new-client
 *
 * Creates a new client tunnel with their first appointment.
 * This handles the complete setup for new clients including tunnel creation.
 */
export const POST: RequestHandler = async ({ request, params }) => {
  try {
    const tenantId = params.id;
    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }

    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    logger.info("Creating new client appointment tunnel", {
      tenantId,
      tunnelId: validatedData.tunnelId,
      appointmentDate: validatedData.appointmentDate,
      duration: validatedData.duration,
      emailHashPrefix: validatedData.emailHash.slice(0, 8),
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const response = await appointmentService.createNewClientWithAppointment(validatedData);

    return json(response);
  } catch (error) {
    logError(logger)("Failed to create new client appointment", error);

    if (error instanceof z.ZodError) {
      return new ValidationError("Invalid request data").toJson();
    }
    if (error instanceof BackendError) {
      return error.toJson();
    }
    return new InternalError().toJson();
  }
};
