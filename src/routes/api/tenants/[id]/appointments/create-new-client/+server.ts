import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { getTenantDb } from "$lib/server/db";
import { eq } from "drizzle-orm";
import {
  clientAppointmentTunnel,
  clientTunnelStaffKeyShare,
  appointment,
  channel,
} from "$lib/server/db/tenant-schema";
import type { AppointmentResponse } from "$lib/types/appointment";
import {
  BackendError,
  InternalError,
  logError,
  NotFoundError,
  ValidationError,
} from "$lib/server/utils/errors";

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
