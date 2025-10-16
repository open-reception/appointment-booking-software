import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { logger } from "$lib/logger";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { ERRORS } from "$lib/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import { StaffService } from "$lib/server/services/staff-service";
import { registerOpenAPIRoute } from "$lib/server/openapi";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/staff", "GET", {
  summary: "Get tenant staff members",
  description:
    "Returns all staff members for a tenant. Requires authentication and tenant membership.",
  tags: ["Staff", "Tenants"],
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
      description: "Staff members retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              staff: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid", description: "User ID" },
                    email: { type: "string", format: "email", description: "User email" },
                    name: { type: "string", description: "User name" },
                    role: {
                      type: "string",
                      enum: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"],
                      description: "User role",
                    },
                    isActive: {
                      type: "boolean",
                      description: "Whether user is active (can be null)",
                    },
                    confirmationState: {
                      type: "string",
                      enum: ["INVITED", "CONFIRMED", "ACCESS_GRANTED"],
                      description: "User confirmation state (can be null)",
                    },
                    createdAt: {
                      type: "string",
                      format: "date-time",
                      description: "Creation timestamp (can be null)",
                    },
                    updatedAt: {
                      type: "string",
                      format: "date-time",
                      description: "Last update timestamp (can be null)",
                    },
                    lastLoginAt: {
                      type: "string",
                      format: "date-time",
                      description: "Last login timestamp (can be null)",
                    },
                  },
                  required: ["id", "email", "name", "role"],
                },
              },
            },
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
  const log = logger.setContext("API");
  const tenantId = params.id;
  if (!tenantId) {
    throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
  }

  checkPermission(locals, tenantId, false);

  try {
    const staff = await StaffService.getStaffMembers(tenantId);
    return json({ staff: staff.filter((it) => it.role !== "GLOBAL_ADMIN") });
  } catch (error) {
    logError(log)("Error fetching staff data", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
