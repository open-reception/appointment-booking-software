/**
 * API Route: Get Client's Future Appointments
 *
 * Returns all future appointments for a client after successful PIN verification.
 * Client must be authenticated via challenge-response before accessing this endpoint.
 */

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { getTenantDb } from "$lib/server/db";
import { clientAppointmentTunnel } from "$lib/server/db/tenant-schema";
import { eq } from "drizzle-orm";
import { registerOpenAPIRoute } from "$lib/server/openapi";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/appointments/my-appointments", "GET", {
  summary: "Get client's future appointments",
  description:
    "Returns all future appointments for a client. Requires the client to be authenticated via PIN challenge-response flow. The emailHash header must match the authenticated client.",
  tags: ["Appointments", "Clients"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "X-Email-Hash",
      in: "header",
      required: true,
      schema: { type: "string" },
      description: "SHA-256 hash of client email for authentication",
    },
  ],
  responses: {
    "200": {
      description: "Future appointments retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              appointments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      format: "uuid",
                      description: "Appointment ID",
                    },
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
                    channelId: {
                      type: "string",
                      format: "uuid",
                      description: "Channel ID",
                    },
                    encryptedData: {
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
                  },
                  required: ["id", "appointmentDate", "status", "channelId", "encryptedData"],
                },
              },
            },
            required: ["appointments"],
          },
        },
      },
    },
    "400": {
      description: "Missing or invalid email hash header",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Client tunnel not found",
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

const emailHashSchema = z.string().min(1);

/**
 * GET /api/tenants/[id]/appointments/my-appointments
 *
 * Returns all future appointments for an authenticated client.
 * The client must provide their email hash in the X-Email-Hash header.
 */
export const GET: RequestHandler = async ({ request, params }) => {
  const log = logger.setContext("API.MyAppointments");
  const tenantId = params.id;

  try {
    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }

    // Get and validate email hash from header
    const emailHash = request.headers.get("X-Email-Hash");
    if (!emailHash) {
      throw new ValidationError("X-Email-Hash header is required");
    }

    const validatedEmailHash = emailHashSchema.parse(emailHash);

    log.debug("Fetching appointments for client", {
      tenantId,
      emailHashPrefix: validatedEmailHash.slice(0, 8),
    });

    // Get client tunnel to verify client exists and get tunnel ID
    const db = await getTenantDb(tenantId);
    const tunnelResult = await db
      .select({
        id: clientAppointmentTunnel.id,
      })
      .from(clientAppointmentTunnel)
      .where(eq(clientAppointmentTunnel.emailHash, validatedEmailHash))
      .limit(1);

    if (tunnelResult.length === 0) {
      log.warn("Client tunnel not found", {
        tenantId,
        emailHashPrefix: validatedEmailHash.slice(0, 8),
      });
      throw new ValidationError("Client not found");
    }

    const tunnel = tunnelResult[0];

    // Get future appointments for this client
    const appointmentService = await AppointmentService.forTenant(tenantId);
    const appointments = await appointmentService.getFutureAppointmentsByTunnelId(tunnel.id);

    log.debug("Future appointments retrieved successfully", {
      tenantId,
      tunnelId: tunnel.id,
      appointmentCount: appointments.length,
    });

    return json({
      appointments: appointments.map((apt) => ({
        id: apt.id,
        appointmentDate: apt.appointmentDate,
        status: apt.status,
        channelId: apt.channelId,
        encryptedData: {
          encryptedPayload: apt.encryptedPayload,
          iv: apt.iv,
          authTag: apt.authTag,
        },
      })),
    });
  } catch (error) {
    logError(log)("Error fetching client appointments", error);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    if (error instanceof z.ZodError) {
      return new ValidationError("Invalid request data").toJson();
    }

    return new InternalError().toJson();
  }
};
