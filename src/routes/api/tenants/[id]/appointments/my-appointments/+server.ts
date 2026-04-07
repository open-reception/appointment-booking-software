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
import {
  AuthenticationError,
  AuthorizationError,
  BackendError,
  InternalError,
  logError,
  ValidationError,
} from "$lib/server/utils/errors";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { getTenantDb } from "$lib/server/db";
import { clientAppointmentTunnel } from "$lib/server/db/tenant-schema";
import { eq } from "drizzle-orm";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import {
  EXISTING_CLIENT_BOOKING_SCOPE,
  verifyBookingAccessToken,
} from "$lib/server/auth/booking-access-token";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/appointments/my-appointments", "GET", {
  summary: "Get client's future appointments",
  description:
    "Returns all future appointments for a client. Requires a valid existing-client booking access token and matching email hash.",
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
    {
      name: "Authorization",
      in: "header",
      required: true,
      schema: { type: "string" },
      description: "Bearer booking access token from /appointments/verify-challenge",
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
    "401": {
      description: "Missing or invalid booking access token",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "403": {
      description: "Booking access token does not match requested tenant or email hash",
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
 * Requires existing-client booking token and matching email hash.
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

    const authorizationHeader = request.headers.get("Authorization");
    if (!authorizationHeader?.startsWith("Bearer ")) {
      throw new AuthenticationError("Booking access token is required");
    }

    const token = authorizationHeader.substring("Bearer ".length).trim();
    if (!token) {
      throw new AuthenticationError("Booking access token is required");
    }

    const tokenPayload = await verifyBookingAccessToken(token);
    if (!tokenPayload) {
      throw new AuthenticationError("Invalid or expired booking access token");
    }

    if (tokenPayload.scope !== EXISTING_CLIENT_BOOKING_SCOPE) {
      throw new AuthorizationError("Booking access token is not valid for this endpoint");
    }

    if (tokenPayload.tenantId !== tenantId) {
      throw new AuthorizationError("Booking access token is not valid for this tenant");
    }

    if (tokenPayload.emailHash !== validatedEmailHash) {
      throw new AuthorizationError("Booking access token is not valid for this email hash");
    }

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
      throw new ValidationError("Tenant or client not found");
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
