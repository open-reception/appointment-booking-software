import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { logger } from "$lib/logger";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { ERRORS } from "$lib/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import { StaffService } from "$lib/server/services/staff-service";
import { registerOpenAPIRoute } from "$lib/server/openapi";

// Register OpenAPI documentation for DELETE
registerOpenAPIRoute("/tenants/{id}/staff/{staffId}", "DELETE", {
  summary: "Delete staff member",
  description:
    "Permanently deletes a staff member from the tenant. This action removes the user account and all associated data including passkeys and client tunnel key shares. Users cannot delete their own account. Requires administrative permissions and operates within a database transaction for data consistency.",
  tags: ["Staff", "Tenants"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "staffId",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Staff member user ID to delete",
    },
  ],
  responses: {
    "200": {
      description: "Staff member deleted successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean", description: "Deletion success status" },
              deletedUser: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid", description: "Deleted user ID" },
                  email: { type: "string", format: "email", description: "Deleted user email" },
                  name: { type: "string", description: "Deleted user name" },
                  role: {
                    type: "string",
                    enum: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"],
                    description: "Deleted user role",
                  },
                },
                required: ["id", "email", "name", "role"],
              },
              deletedPasskeysCount: { type: "number", description: "Number of deleted passkeys" },
              deletedKeySharesCount: {
                type: "number",
                description: "Number of deleted client tunnel key shares",
              },
            },
            required: ["success", "deletedUser", "deletedPasskeysCount", "deletedKeySharesCount"],
          },
        },
      },
    },
    "400": {
      description: "Invalid input data or cannot delete own account",
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
    "404": {
      description: "Staff member not found",
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

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");
  const tenantId = params.id;
  const staffId = params.staffId;

  if (!tenantId) {
    throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
  }

  if (!staffId) {
    throw new ValidationError("Staff ID is required");
  }

  // Require administrative permissions
  checkPermission(locals, tenantId, true);

  try {
    const result = await StaffService.deleteStaffMember(tenantId, staffId, locals.user?.userId);

    return json(result);
  } catch (error) {
    logError(log)("Error deleting staff member", error, locals.user?.userId, tenantId);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
