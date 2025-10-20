import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { logger } from "$lib/logger";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { ERRORS } from "$lib/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import { StaffService } from "$lib/server/services/staff-service";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import z from "zod";

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

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}/staff/{staffId}", "PUT", {
  summary: "Update staff member",
  description:
    "Updates a staff member's role, email, name, and active status. Users cannot deactivate their own account. Requires administrative permissions.",
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
      description: "Staff member user ID to update",
    },
  ],
  requestBody: {
    description: "Staff member update data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              format: "uuid",
              description: "User ID to update",
            },
            email: {
              type: "string",
              format: "email",
              description: "New email address (optional)",
            },
            name: {
              type: "string",
              minLength: 1,
              description: "New name (optional)",
            },
            role: {
              type: "string",
              enum: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"],
              description: "New role (optional)",
            },
            isActive: {
              type: "boolean",
              description: "Active status (optional, cannot set to false for own account)",
            },
          },
          required: ["userId"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Staff member updated successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              email: { type: "string", format: "email", description: "User email" },
              name: { type: "string", description: "User name" },
              role: {
                type: "string",
                enum: ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"],
                description: "User role",
              },
              isActive: { type: "boolean", description: "Whether user is active (can be null)" },
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
    "400": {
      description: "Invalid input data or cannot deactivate own account",
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

export const DELETE: RequestHandler = async ({ request, params, locals }) => {
  const log = logger.setContext("API");
  const tenantId = params.id;
  const staffId = params.staffId;
  const { searchParams } = new URL(request.url);
  const confirmationState = searchParams.get("confirmationState") as
    | "INVITED"
    | "CONFIRMED"
    | "ACCESS_GRANTED"
    | undefined;

  if (!tenantId) {
    throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
  }

  if (!staffId) {
    throw new ValidationError("Staff ID is required");
  }

  // Require administrative permissions
  checkPermission(locals, tenantId, true);

  try {
    const result = await StaffService.deleteStaffMember(
      tenantId,
      staffId,
      locals.user?.userId,
      confirmationState,
    );

    return json(result);
  } catch (error) {
    logError(log)("Error deleting staff member", error, locals.user?.userId, tenantId);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

const userUpdateSchema = z.object({
  email: z.string().email("Invalid email format").optional(),
  name: z.string().min(1, "Name cannot be empty").optional(),
  role: z
    .enum(["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"], {
      errorMap: () => ({ message: "Invalid role" }),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

export const PUT: RequestHandler = async ({ params, locals, request }) => {
  const log = logger.setContext("API");
  const tenantId = params.id;
  const staffId = params.staffId;
  if (!tenantId) {
    throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
  }
  if (!staffId) {
    throw new ValidationError(ERRORS.STAFF.NO_STAFF_ID);
  }

  checkPermission(locals, tenantId, true);

  try {
    const requestData = await request.json();
    const validation = userUpdateSchema.safeParse(requestData);

    if (!validation.success) {
      throw new ValidationError(
        "Invalid user update data: " + validation.error.errors.map((e) => e.message).join(", "),
      );
    }

    const updateData = validation.data;

    const updatedUser = await StaffService.updateStaffMember(
      tenantId,
      staffId,
      updateData,
      locals.user?.userId,
    );

    return json(updatedUser);
  } catch (error) {
    logError(log)("Error updating staff member", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
