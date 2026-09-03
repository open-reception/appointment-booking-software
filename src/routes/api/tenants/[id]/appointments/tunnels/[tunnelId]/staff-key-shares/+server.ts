import { logger } from "$lib/logger";
import { centralDb, getTenantDb } from "$lib/server/db";
import { user } from "$lib/server/db/central-schema";
import { clientTunnelStaffKeyShare } from "$lib/server/db/tenant-schema";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import {
  AuthenticationError,
  AuthorizationError,
  BackendError,
  InternalError,
  logError,
  ValidationError,
} from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/appointments/tunnels/{tunnelId}/staff-key-shares", "GET", {
  summary: "Get staff key shares for a specific tunnel",
  description:
    "Get staff key shares for a specific tunnel. This is used when a staff member needs access to decrypt a specific client tunnel.",
  tags: ["Appointments", "Tunnels", "Staff"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "tunnelId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tunnel ID",
    },
  ],
  responses: {
    "200": {
      description: "Staff key shares retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              keyShares: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    encryptedTunnelKey: { type: "string", description: "Encrypted tunnel key" },
                    tunnelId: { type: "string", format: "uuid", description: "Tunnel ID" },
                    passkeyId: { type: "string", format: "uuid", description: "Passkey ID" },
                  },
                  required: ["encryptedTunnelKey", "tunnelId", "passkeyId"],
                },
                description: "Retrieved key shares",
              },
            },
            required: ["keyShares"],
          },
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
      description: "Forbidden",
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
  const log = logger.setContext("API.GetStaffKeyShares");
  const tenantId = params.id;
  const tunnelId = params.tunnelId;
  const userId = locals.user?.id;

  if (!tenantId) {
    throw new ValidationError("Tenant ID is required");
  }

  if (!tunnelId) {
    throw new ValidationError("Tunnel ID is required");
  }

  if (!userId) {
    throw new AuthenticationError("User ID is required");
  }

  checkPermission(locals, tenantId);

  try {
    log.debug("Getting staff key shares for tunnel", {
      tenantId,
      tunnelId,
      userId: locals.user?.id,
    });

    const staffUser = await centralDb
      .select({
        id: user.id,
        tenantId: user.tenantId,
        isActive: user.isActive,
        role: user.role,
        confirmationState: user.confirmationState,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (staffUser.length === 0) {
      throw new AuthenticationError("User not found");
    }

    if (staffUser[0].tenantId !== tenantId) {
      throw new AuthorizationError("Staff user does not belong to this tenant");
    }

    if (!staffUser[0].isActive) {
      throw new AuthorizationError("Staff user is inactive");
    }

    const db = await getTenantDb(tenantId);

    const tunnelAccess = await db
      .select({
        tunnelId: clientTunnelStaffKeyShare.tunnelId,
      })
      .from(clientTunnelStaffKeyShare)
      .where(
        and(
          eq(clientTunnelStaffKeyShare.userId, userId),
          eq(clientTunnelStaffKeyShare.tunnelId, tunnelId),
        ),
      )
      .limit(1);

    if (tunnelAccess.length === 0) {
      throw new AuthorizationError(
        "User does not have access to this tunnel or tunnel does not exist",
      );
    }

    const keyShares = await db
      .select({
        tunnelId: clientTunnelStaffKeyShare.tunnelId,
        encryptedTunnelKey: clientTunnelStaffKeyShare.encryptedTunnelKey,
        passkeyId: clientTunnelStaffKeyShare.passkeyId,
      })
      .from(clientTunnelStaffKeyShare)
      .where(
        and(
          eq(clientTunnelStaffKeyShare.userId, userId),
          eq(clientTunnelStaffKeyShare.tunnelId, tunnelId),
        ),
      );

    return json({
      keyShares,
    });
  } catch (error) {
    logError(log)("Error getting staff key shares", error, locals.user?.id, tenantId);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
