import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { getTenantDb } from "$lib/server/db";
import { clientAppointmentTunnel, appointment, channel } from "$lib/server/db/tenant-schema.js";
import type { AppointmentResponse } from "$lib/types/appointment";
import { and, eq } from "drizzle-orm";
import {
  ValidationError,
  InternalError,
  BackendError,
  NotFoundError,
  logError,
} from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";

const requestSchema = z.object({
  emailHash: z.string(),
  tunnelId: z.string(),
  channelId: z.string(),
  agentId: z.string(),
  appointmentDate: z.string(),
  encryptedAppointment: z.object({
    encryptedPayload: z.string(),
    iv: z.string(),
    authTag: z.string(),
  }),
});

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/appointments/add-to-tunnel", "POST", {
  summary: "Add appointment to existing tunnel",
  description:
    "Adds a new appointment to an existing client tunnel. For clients who already have appointments and want to book another one.",
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
    description: "Appointment data for existing tunnel",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            emailHash: {
              type: "string",
              description: "SHA-256 hash of client email for verification",
              example: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
            },
            tunnelId: {
              type: "string",
              format: "uuid",
              description: "Existing client tunnel identifier",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            channelId: {
              type: "string",
              format: "uuid",
              description: "Channel ID for the appointment",
              example: "550e8400-e29b-41d4-a716-446655440001",
            },
            appointmentDate: {
              type: "string",
              format: "date-time",
              description: "Appointment date and time (ISO 8601)",
              example: "2024-12-31T14:30:00.000Z",
            },
            encryptedAppointment: {
              type: "object",
              properties: {
                encryptedPayload: {
                  type: "string",
                  description: "AES-encrypted appointment data",
                  example: "deadbeef123456789abcdef...",
                },
                iv: {
                  type: "string",
                  description: "Initialization vector for AES encryption",
                  example: "123456789abcdef...",
                },
                authTag: {
                  type: "string",
                  description: "Authentication tag for AES-GCM",
                  example: "fedcba9876543210...",
                },
              },
              required: ["encryptedPayload", "iv", "authTag"],
              description: "Encrypted appointment data",
            },
          },
          required: [
            "emailHash",
            "tunnelId",
            "channelId",
            "appointmentDate",
            "encryptedAppointment",
          ],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Appointment added to tunnel successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
                description: "Created appointment ID",
                example: "550e8400-e29b-41d4-a716-446655440002",
              },
              appointmentDate: {
                type: "string",
                format: "date-time",
                description: "Appointment date and time",
                example: "2024-12-31T14:30:00.000Z",
              },
              status: {
                type: "string",
                enum: ["NEW", "CONFIRMED"],
                description: "Initial appointment status (depends on channel configuration)",
                example: "NEW",
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
      description: "Tunnel or channel not found",
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
 * POST /api/tenants/[id]/appointments/add-to-tunnel
 *
 * Adds a new appointment to an existing client tunnel.
 * For clients who already have appointments and want to book another one.
 */
export const POST: RequestHandler = async ({ request, params }) => {
  try {
    const tenantId = params.id;
    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }

    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    logger.info("Adding appointment to existing tunnel", {
      tenantId,
      tunnelId: validatedData.tunnelId,
      appointmentDate: validatedData.appointmentDate,
      emailHashPrefix: validatedData.emailHash.slice(0, 8),
    });

    const db = await getTenantDb(tenantId);

    // Check if tunnel exists and belongs to client
    const tunnelResult = await db
      .select({
        id: clientAppointmentTunnel.id,
      })
      .from(clientAppointmentTunnel)
      .where(eq(clientAppointmentTunnel.emailHash, validatedData.emailHash))
      .limit(1);

    if (tunnelResult.length === 0) {
      logger.warn("Client tunnel not found", {
        tenantId,
        tunnelId: validatedData.tunnelId,
        emailHashPrefix: validatedData.emailHash.slice(0, 8),
      });
      throw new NotFoundError("Tunnel not found or access denied");
    }

    // Get channel configuration to determine initial status
    const channelResult = await db
      .select({ requiresConfirmation: channel.requiresConfirmation })
      .from(channel)
      .where(and(eq(channel.id, validatedData.channelId), eq(channel.isPublic, true)))
      .limit(1);

    if (channelResult.length === 0) {
      throw new NotFoundError("Active channel not found");
    }

    const initialStatus = channelResult[0].requiresConfirmation ? "NEW" : "CONFIRMED";

    // Create encrypted appointment
    const appointmentResult = await db
      .insert(appointment)
      .values({
        tunnelId: validatedData.tunnelId,
        channelId: validatedData.channelId,
        agentId: validatedData.agentId,
        appointmentDate: new Date(validatedData.appointmentDate),
        encryptedPayload: validatedData.encryptedAppointment.encryptedPayload,
        iv: validatedData.encryptedAppointment.iv,
        authTag: validatedData.encryptedAppointment.authTag,
        status: initialStatus,
      })
      .returning({
        id: appointment.id,
        appointmentDate: appointment.appointmentDate,
        status: appointment.status,
      });

    if (appointmentResult.length === 0) {
      throw new InternalError("Failed to create appointment");
    }

    const result = appointmentResult[0];

    const response: AppointmentResponse = {
      id: result.id,
      appointmentDate: result.appointmentDate.toISOString(),
      status: result.status,
    };

    logger.info("Successfully added appointment to tunnel", {
      tenantId,
      tunnelId: validatedData.tunnelId,
      appointmentId: result.id,
    });

    return json(response);
  } catch (error) {
    logError(logger)("Failed to add appointment to tunnel", error);

    if (error instanceof z.ZodError) {
      return json({ error: "Invalid request data", details: error.issues }, { status: 400 });
    }

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
