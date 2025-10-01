import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { logger } from "$lib/logger";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { ERRORS } from "$lib/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import { centralDb } from "$lib/server/db";
import { user } from "$lib/server/db/central-schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
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

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}/staff", "PUT", {
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
              id: { type: "string", format: "uuid", description: "User ID" },
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

export interface UserData {
  id: string;
  email: string;
  name: string;
  role: "GLOBAL_ADMIN" | "TENANT_ADMIN" | "STAFF";
  isActive: boolean | null;
  confirmationState: "INVITED" | "CONFIRMED" | "ACCESS_GRANTED" | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  lastLoginAt: Date | null;
}

const userUpdateSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  email: z.string().email("Invalid email format").optional(),
  name: z.string().min(1, "Name cannot be empty").optional(),
  role: z
    .enum(["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"], {
      errorMap: () => ({ message: "Invalid role" }),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

export const GET: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");
  const tenantId = params.id;
  if (!tenantId) {
    throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
  }

  checkPermission(locals, tenantId, false);

  try {
    const staff: UserData[] = await centralDb
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        confirmationState: user.confirmationState,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      })
      .from(user)
      .where(eq(user.tenantId, tenantId));
    return json(staff);
  } catch (error) {
    logError(log)("Error fetching staff data", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

export const PUT: RequestHandler = async ({ params, locals, request }) => {
  const log = logger.setContext("API");
  const tenantId = params.id;
  if (!tenantId) {
    throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
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

    const { userId, ...updateData } = validation.data;

    if (updateData.isActive === false && locals.user?.userId === userId) {
      throw new ValidationError("You cannot deactivate your own account");
    }

    const updatedUser = await centralDb
      .update(user)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(and(eq(user.id, userId), eq(user.tenantId, tenantId)))
      .returning({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        confirmationState: user.confirmationState,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      });

    if (updatedUser.length === 0) {
      throw new InternalError("Failed to update user");
    }

    return json(updatedUser[0]);
  } catch (error) {
    logError(log)("Error updating staff member", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
