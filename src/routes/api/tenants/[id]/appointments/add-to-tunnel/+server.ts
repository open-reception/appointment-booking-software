import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { getTenantDb } from "$lib/server/db";
import { clientAppointmentTunnel, appointment, channel } from "$lib/server/db/tenant-schema.js";
import type { AppointmentResponse } from "$lib/types/appointment";
import { eq } from "drizzle-orm";
import {
  ValidationError,
  InternalError,
  BackendError,
  NotFoundError,
  logError,
} from "$lib/server/utils/errors";

const requestSchema = z.object({
  emailHash: z.string(),
  tunnelId: z.string(),
  channelId: z.string(),
  appointmentDate: z.string(),
  encryptedAppointment: z.object({
    encryptedPayload: z.string(),
    iv: z.string(),
    authTag: z.string(),
  }),
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
      .where(eq(channel.id, validatedData.channelId))
      .limit(1);

    if (channelResult.length === 0) {
      throw new NotFoundError("Channel not found");
    }

    const initialStatus = channelResult[0].requiresConfirmation ? "NEW" : "CONFIRMED";

    // Create encrypted appointment
    const appointmentResult = await db
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
      return json({ error: "Invalid request data", details: error.errors }, { status: 400 });
    }

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
