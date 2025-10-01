import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { getTenantDb, centralDb } from "$lib/server/db";
import { eq, and } from "drizzle-orm";
import {
  clientAppointmentTunnel,
  clientTunnelStaffKeyShare,
  appointment,
  channel,
} from "$lib/server/db/tenant-schema";
import { user } from "$lib/server/db/central-schema";
import type { AppointmentResponse } from "$lib/types/appointment";
import {
  BackendError,
  InternalError,
  logError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";

const requestSchema = z.object({
  tunnelId: z.string(),
  channelId: z.string(),
  appointmentDate: z.string(),
  emailHash: z.string(),
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
      emailHashPrefix: validatedData.emailHash.slice(0, 8),
    });

    // Check if there are any authorized users (ACCESS_GRANTED) in this tenant
    const authorizedUsers = await centralDb
      .select({ count: user.id })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.confirmationState, "ACCESS_GRANTED")))
      .limit(1);

    if (authorizedUsers.length === 0) {
      logger.warn("Client creation blocked: No authorized users in tenant", {
        tenantId,
        tunnelId: validatedData.tunnelId,
      });
      throw new ConflictError(
        "Cannot create client appointments: No authorized users found in tenant. At least one user must have ACCESS_GRANTED status.",
      );
    }

    // Now get the tenant database after authorization check
    const db = await getTenantDb(tenantId);

    // Transactional: Create tunnel and appointment
    const result = await db.transaction(async (tx) => {
      // 1. Create client appointment tunnel
      const tunnelResult = await tx
        .insert(clientAppointmentTunnel)
        .values({
          id: validatedData.tunnelId,
          emailHash: validatedData.emailHash,
          clientPublicKey: validatedData.clientPublicKey,
          privateKeyShare: validatedData.privateKeyShare,
          clientEncryptedTunnelKey: validatedData.clientEncryptedTunnelKey,
        })
        .returning({ id: clientAppointmentTunnel.id });

      if (tunnelResult.length === 0) {
        throw new InternalError("Failed to create client appointment tunnel");
      }

      // 2. Store staff key shares for the tunnel
      if (validatedData.staffKeyShares.length > 0) {
        await tx.insert(clientTunnelStaffKeyShare).values(
          validatedData.staffKeyShares.map((share) => ({
            tunnelId: validatedData.tunnelId,
            userId: share.userId,
            encryptedTunnelKey: share.encryptedTunnelKey,
          })),
        );
      }

      // 3. Get channel configuration to determine initial status
      const channelResult = await tx
        .select({ requiresConfirmation: channel.requiresConfirmation })
        .from(channel)
        .where(eq(channel.id, validatedData.channelId))
        .limit(1);

      if (channelResult.length === 0) {
        throw new NotFoundError("Channel not found");
      }

      const initialStatus = channelResult[0].requiresConfirmation ? "NEW" : "CONFIRMED";

      // 4. Create encrypted appointment
      const appointmentResult = await tx
        .insert(appointment)
        .values({
          tunnelId: validatedData.tunnelId,
          channelId: validatedData.channelId,
          appointmentDate: new Date(validatedData.appointmentDate),
          encryptedPayload: validatedData.encryptedAppointment.encryptedPayload,
          iv: validatedData.encryptedAppointment.iv,
          authTag: validatedData.encryptedAppointment.authTag,
          status: initialStatus,
          isEncrypted: true,
        })
        .returning({
          id: appointment.id,
          appointmentDate: appointment.appointmentDate,
          status: appointment.status,
        });

      if (appointmentResult.length === 0) {
        throw new InternalError("Failed to create appointment");
      }

      return appointmentResult[0];
    });

    const response: AppointmentResponse = {
      id: result.id,
      appointmentDate: result.appointmentDate.toISOString(),
      status: result.status,
    };

    logger.info("Successfully created new client appointment tunnel", {
      tenantId,
      tunnelId: validatedData.tunnelId,
      appointmentId: result.id,
      staffSharesCount: validatedData.staffKeyShares.length,
    });

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
