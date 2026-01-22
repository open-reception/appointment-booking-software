/**
 * API Route: Client Delete Own Appointment
 *
 * Allows a client to delete their own appointment after successful PIN verification.
 * Requires challenge-response authentication to prove ownership.
 */

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { registerOpenAPIRoute } from "$lib/server/openapi";

const requestSchema = z.object({
  emailHash: z.string().min(1),
  challengeId: z.string().min(1),
  challengeResponse: z.string().min(1),
});

// Register OpenAPI documentation for DELETE
registerOpenAPIRoute("/tenants/{id}/appointments/{appointmentId}/delete-by-client", "DELETE", {
  summary: "Delete appointment by client",
  description:
    "Allows a client to delete their own appointment. Requires challenge-response authentication to prove the client knows their PIN. The appointment must belong to the client's tunnel.",
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
      name: "appointmentId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Appointment ID to delete",
    },
  ],
  requestBody: {
    description: "Challenge-response authentication data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            emailHash: {
              type: "string",
              description: "SHA-256 hash of client email",
            },
            challengeId: {
              type: "string",
              description: "Challenge ID from /appointments/challenge endpoint",
            },
            challengeResponse: {
              type: "string",
              description: "Decrypted challenge response (base64 encoded)",
            },
          },
          required: ["emailHash", "challengeId", "challengeResponse"],
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
              message: {
                type: "string",
                example: "Appointment deleted successfully",
              },
            },
          },
        },
      },
    },
    "400": {
      description: "Invalid authentication or appointment doesn't belong to client",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "404": {
      description: "Appointment or client not found",
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
 * DELETE /api/tenants/[id]/appointments/[appointmentId]/delete-by-client
 *
 * Deletes an appointment after verifying the client's identity via challenge-response.
 * This ensures only the client who owns the appointment (and knows the PIN) can delete it.
 */
export const DELETE: RequestHandler = async ({ request, params }) => {
  const log = logger.setContext("API.ClientDeleteAppointment");
  const tenantId = params.id;
  const appointmentId = params.appointmentId;

  try {
    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }

    if (!appointmentId) {
      throw new ValidationError("Appointment ID is required");
    }

    const body = await request.json();
    const { emailHash, challengeId, challengeResponse } = requestSchema.parse(body);

    log.info("Client deleting appointment", {
      tenantId,
      appointmentId,
      emailHashPrefix: emailHash.slice(0, 8),
    });

    // Delete appointment with authentication verification
    const appointmentService = await AppointmentService.forTenant(tenantId);
    await appointmentService.deleteAppointmentByClient(
      appointmentId,
      emailHash,
      challengeId,
      challengeResponse,
    );

    log.info("Appointment deleted successfully by client", {
      tenantId,
      appointmentId,
      emailHashPrefix: emailHash.slice(0, 8),
    });

    return json({
      message: "Appointment deleted successfully",
    });
  } catch (error) {
    logError(log)("Error deleting appointment by client", error);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    if (error instanceof z.ZodError) {
      return new ValidationError("Invalid request data").toJson();
    }

    return new InternalError().toJson();
  }
};
