/**
 * API Route: Add Staff Key Shares to All Tunnels
 *
 * Adds clientTunnelStaffKeyShare entries for a new staff member to all existing tunnels.
 * This is used when a new staff member joins and needs access to decrypt all existing client tunnels.
 * The frontend must encrypt the tunnel keys with the new staff member's public key.
 */

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import { getTenantDb, centralDb } from "$lib/server/db";
import { clientAppointmentTunnel, clientTunnelStaffKeyShare } from "$lib/server/db/tenant-schema";
import { user } from "$lib/server/db/central-schema";
import { eq } from "drizzle-orm";
import { registerOpenAPIRoute } from "$lib/server/openapi";

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/appointments/tunnels/add-staff-key-shares", "POST", {
  summary: "Add staff key shares to all tunnels",
  description:
    "Adds clientTunnelStaffKeyShare entries for a new staff member to a set of existing tunnels. This is used when a new staff member joins and needs access to decrypt all existing client tunnels.",
  tags: ["Appointments", "Tunnels", "Staff"],
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
    description: "Staff key shares data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            staffUserId: {
              type: "string",
              format: "uuid",
              description: "User ID of the staff member to add key shares for",
            },
            keyShares: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tunnelId: {
                    type: "string",
                    format: "uuid",
                    description: "Tunnel ID to add key share for",
                  },
                  encryptedTunnelKey: {
                    type: "string",
                    description: "Tunnel key encrypted with staff member's public key",
                  },
                },
                required: ["tunnelId", "encryptedTunnelKey"],
              },
              description: "Array of tunnel key shares to add (minimum 1 item)",
            },
          },
          required: ["staffUserId", "keyShares"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Staff key shares added successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", description: "Operation success status" },
              message: { type: "string", description: "Success message" },
              added: { type: "number", description: "Number of key shares added" },
              skipped: {
                type: "number",
                description: "Number of key shares skipped (already existed)",
              },
              keyShares: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid", description: "Key share ID" },
                    tunnelId: { type: "string", format: "uuid", description: "Tunnel ID" },
                  },
                  required: ["id", "tunnelId"],
                },
                description: "Added key shares (optional)",
              },
            },
            required: ["success", "message", "added", "skipped"],
          },
        },
      },
    },
    "400": {
      description: "Invalid input data",
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
      description: "Administrative permissions required",
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

const requestSchema = z.object({
  staffUserId: z.string().uuid("Invalid staff user ID format"),
  keyShares: z
    .array(
      z.object({
        tunnelId: z.string().uuid("Invalid tunnel ID format"),
        encryptedTunnelKey: z.string().min(1, "Encrypted tunnel key cannot be empty"),
      }),
    )
    .min(1, "At least one key share is required"),
});

export const POST: RequestHandler = async ({ params, locals, request }) => {
  const log = logger.setContext("API.AddStaffKeyShares");
  const tenantId = params.id;

  if (!tenantId) {
    throw new ValidationError("Tenant ID is required");
  }

  checkPermission(locals, tenantId, false); // Administrative Rechte erforderlich

  try {
    const requestData = await request.json();
    const validation = requestSchema.safeParse(requestData);

    if (!validation.success) {
      throw new ValidationError(
        "Invalid request data: " + validation.error.errors.map((e) => e.message).join(", "),
      );
    }

    const { staffUserId, keyShares } = validation.data;

    log.debug("Adding staff key shares to tunnels", {
      tenantId,
      staffUserId,
      keyShareCount: keyShares.length,
      requesterId: locals.user?.userId,
    });

    const staffUser = await centralDb
      .select({
        id: user.id,
        tenantId: user.tenantId,
        isActive: user.isActive,
        role: user.role,
      })
      .from(user)
      .where(eq(user.id, staffUserId))
      .limit(1);

    if (staffUser.length === 0) {
      throw new ValidationError("Staff user not found");
    }

    if (staffUser[0].tenantId !== tenantId) {
      throw new ValidationError("Staff user does not belong to this tenant");
    }

    if (!staffUser[0].isActive) {
      throw new ValidationError("Staff user is inactive");
    }

    const db = await getTenantDb(tenantId);

    const existingTunnels = await db
      .select({ id: clientAppointmentTunnel.id })
      .from(clientAppointmentTunnel);

    const existingTunnelIds = new Set(existingTunnels.map((t) => t.id));
    const requestedTunnelIds = new Set(keyShares.map((ks) => ks.tunnelId));

    const invalidTunnelIds = [...requestedTunnelIds].filter((id) => !existingTunnelIds.has(id));
    if (invalidTunnelIds.length > 0) {
      throw new ValidationError(`Invalid or inactive tunnel IDs: ${invalidTunnelIds.join(", ")}`);
    }

    const existingKeyShares = await db
      .select({ tunnelId: clientTunnelStaffKeyShare.tunnelId })
      .from(clientTunnelStaffKeyShare)
      .where(eq(clientTunnelStaffKeyShare.userId, staffUserId));

    const existingKeyShareTunnelIds = new Set(existingKeyShares.map((ks) => ks.tunnelId));
    const duplicateKeyShares = keyShares.filter((ks) => existingKeyShareTunnelIds.has(ks.tunnelId));

    if (duplicateKeyShares.length > 0) {
      log.warn("Some key shares already exist", {
        tenantId,
        staffUserId,
        duplicateCount: duplicateKeyShares.length,
      });
    }

    const newKeyShares = keyShares.filter((ks) => !existingKeyShareTunnelIds.has(ks.tunnelId));

    if (newKeyShares.length === 0) {
      log.info("No new key shares to add - all already exist", {
        tenantId,
        staffUserId,
        totalRequested: keyShares.length,
      });

      return json({
        success: true,
        message: "All key shares already exist",
        added: 0,
        skipped: keyShares.length,
      });
    }

    const result = await db.transaction(async (tx) => {
      const insertedKeyShares = await tx
        .insert(clientTunnelStaffKeyShare)
        .values(
          newKeyShares.map((keyShare) => ({
            tunnelId: keyShare.tunnelId,
            userId: staffUserId,
            encryptedTunnelKey: keyShare.encryptedTunnelKey,
          })),
        )
        .returning({
          id: clientTunnelStaffKeyShare.id,
          tunnelId: clientTunnelStaffKeyShare.tunnelId,
        });

      return insertedKeyShares;
    });

    log.info("Staff key shares added successfully", {
      tenantId,
      staffUserId,
      addedCount: result.length,
      skippedCount: duplicateKeyShares.length,
      requesterId: locals.user?.userId,
    });

    return json({
      success: true,
      message: `Successfully added ${result.length} key shares`,
      added: result.length,
      skipped: duplicateKeyShares.length,
      keyShares: result.map((ks) => ({
        id: ks.id,
        tunnelId: ks.tunnelId,
      })),
    });
  } catch (error) {
    logError(log)("Error adding staff key shares", error, locals.user?.userId, tenantId);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
