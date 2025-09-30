/**
 * API Route: Get Client Tunnels
 *
 * Returns all client appointment tunnels for a tenant.
 * Used by staff to see all client tunnels that exist in the system.
 * Requires the requesting user to be authenticated and belong to the tenant.
 */

import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { logger } from "$lib/logger";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import { getTenantDb } from "$lib/server/db";
import { clientAppointmentTunnel } from "$lib/server/db/tenant-schema";
import { registerOpenAPIRoute } from "$lib/server/openapi";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/appointments/tunnels", "GET", {
  summary: "Get client tunnels",
  description:
    "Returns all active client appointment tunnels for a tenant. Used by staff to see all client tunnels that exist in the system. Requires authentication and tenant membership.",
  tags: ["Appointments", "Tunnels"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
  ],
  responses: {
    "200": {
      description: "Client tunnels retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              tunnels: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid", description: "Tunnel ID" },
                    emailHash: { type: "string", description: "SHA-256 hash of client email" },
                    clientPublicKey: {
                      type: "string",
                      description: "Client's ML-KEM-768 public key",
                    },
                    createdAt: {
                      type: "string",
                      format: "date-time",
                      description: "Creation timestamp",
                    },
                    updatedAt: {
                      type: "string",
                      format: "date-time",
                      description: "Last update timestamp",
                    },
                    isActive: { type: "boolean", description: "Whether tunnel is active" },
                  },
                  required: ["id", "emailHash", "clientPublicKey", "isActive"],
                },
              },
            },
            required: ["tunnels"],
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
      description: "Insufficient permissions",
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

export const GET: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API.ClientTunnels");
  const tenantId = params.id;

  if (!tenantId) {
    throw new ValidationError("Tenant ID is required");
  }

  checkPermission(locals, tenantId, false);

  try {
    log.debug("Fetching client tunnels", { tenantId, requesterId: locals.user?.userId });

    const db = await getTenantDb(tenantId);

    const tunnels = await db
      .select({
        id: clientAppointmentTunnel.id,
        emailHash: clientAppointmentTunnel.emailHash,
        clientPublicKey: clientAppointmentTunnel.clientPublicKey,
        createdAt: clientAppointmentTunnel.createdAt,
        updatedAt: clientAppointmentTunnel.updatedAt,
      })
      .from(clientAppointmentTunnel)
      .orderBy(clientAppointmentTunnel.createdAt);

    log.debug("Client tunnels retrieved successfully", {
      tenantId,
      requesterId: locals.user?.userId,
      tunnelCount: tunnels.length,
    });

    return json({
      tunnels: tunnels.map((tunnel) => ({
        id: tunnel.id,
        emailHash: tunnel.emailHash,
        clientPublicKey: tunnel.clientPublicKey,
        createdAt: tunnel.createdAt?.toISOString(),
        updatedAt: tunnel.updatedAt?.toISOString(),
      })),
    });
  } catch (error) {
    logError(log)("Error fetching client tunnels", error, locals.user?.userId, tenantId);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
