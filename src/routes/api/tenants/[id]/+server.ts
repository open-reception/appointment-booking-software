import { json } from "@sveltejs/kit";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import {
  ValidationError,
  BackendError,
  ConflictError,
  InternalError,
  logError,
  NotFoundError,
} from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";
import { ERRORS } from "$lib/errors";

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}", "PUT", {
  summary: "Update tenant metadata",
  description:
    "Updates the metadata for a specific tenant (longName, shortName, description, logo)",
  tags: ["Tenants"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string" },
      description: "Tenant ID",
    },
  ],
  requestBody: {
    description: "Tenant metadata updates",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            longName: {
              type: "string",
              description: "Full name of the tenant organization",
              example: "ACME Corporation",
            },
            shortName: {
              type: "string",
              minLength: 4,
              maxLength: 15,
              description: "Short name for the tenant (4-15 characters)",
              example: "acme-corp",
            },
            descriptions: {
              type: "array",
              description: "Description of the tenant organization",
              example: `["Leading provider of innovative solutions"]`,
            },
            languages: {
              type: "array",
              description: "Active languages of the tenant organization",
              example: `["en", "de"]`,
            },
            logo: {
              type: "string",
              description: "URL or base64 encoded logo image",
              example: "https://example.com/logo.png",
            },
          },
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Tenant metadata updated successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              tenant: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Tenant ID" },
                  shortName: { type: "string", description: "Short name" },
                  longName: { type: "string", description: "Long name" },
                  description: { type: "string", description: "Description" },
                  logo: { type: "string", description: "Logo URL" },
                  updatedAt: {
                    type: "string",
                    format: "date-time",
                    description: "Last update timestamp",
                  },
                },
              },
            },
            required: ["message", "tenant"],
          },
          example: {
            message: "Tenant metadata updated successfully",
            tenant: {
              id: "01234567-89ab-cdef-0123-456789abcdef",
              shortName: "acme-corp",
              longName: "ACME Corporation",
              description: "Leading provider of innovative solutions",
              logo: "https://example.com/logo.png",
              updatedAt: "2024-01-01T12:00:00Z",
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
          example: { error: "Invalid tenant data" },
        },
      },
    },
    "404": {
      description: "Tenant not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Tenant not found" },
        },
      },
    },
    "409": {
      description: "Short name already exists",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: ERRORS.TENANTS.NAME_EXISTS },
        },
      },
    },
    "500": {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Internal server error" },
        },
      },
    },
  },
});

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}", "GET", {
  summary: "Get tenant details",
  description: "Retrieves detailed information about a specific tenant",
  tags: ["Tenants"],
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
      description: "Tenant details retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              tenant: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid", description: "Tenant ID" },
                  shortName: { type: "string", description: "Short name" },
                  longName: { type: "string", description: "Long name" },
                  description: { type: "string", description: "Description" },
                  logo: { type: "string", description: "Logo data" },
                  setupState: {
                    type: "string",
                    enum: ["NEW", "SETTINGS_CREATED", "AGENTS_SET_UP", "FIRST_CHANNEL_CREATED"],
                    description: "Current setup state",
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
                },
                required: ["id", "shortName", "setupState", "createdAt", "updatedAt"],
              },
            },
            required: ["tenant"],
          },
          example: {
            tenant: {
              id: "01234567-89ab-cdef-0123-456789abcdef",
              shortName: "acme-corp",
              longName: "ACME Corporation",
              description: "Leading provider of innovative solutions",
              logo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
              setupState: "FIRST_CHANNEL_CREATED",
              createdAt: "2024-01-01T10:00:00Z",
              updatedAt: "2024-01-01T12:00:00Z",
            },
          },
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
    "404": {
      description: "Tenant not found",
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

// Register OpenAPI documentation for DELETE
registerOpenAPIRoute("/tenants/{id}", "DELETE", {
  summary: "Delete tenant",
  description:
    "Permanently deletes a tenant and all associated data. This operation drops the tenant's database, removes tenant assignments from global admins, deletes non-global-admin users, and removes the tenant record. Only global admins can perform this operation.",
  tags: ["Tenants"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID to delete",
    },
  ],
  responses: {
    "200": {
      description: "Tenant deleted successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              result: {
                type: "object",
                properties: {
                  tenantId: { type: "string", format: "uuid", description: "Deleted tenant ID" },
                  shortName: { type: "string", description: "Deleted tenant short name" },
                  deletedUsersCount: { type: "number", description: "Number of users deleted" },
                  updatedGlobalAdminsCount: {
                    type: "number",
                    description: "Number of global admins whose tenant assignment was removed",
                  },
                  deletedConfigsCount: {
                    type: "number",
                    description: "Number of configuration entries deleted",
                  },
                  deletedUsers: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        email: { type: "string" },
                        role: { type: "string" },
                      },
                    },
                    description: "List of deleted users",
                  },
                  updatedGlobalAdmins: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        email: { type: "string" },
                        role: { type: "string" },
                      },
                    },
                    description: "List of global admins whose tenant assignment was removed",
                  },
                },
                required: [
                  "tenantId",
                  "shortName",
                  "deletedUsersCount",
                  "updatedGlobalAdminsCount",
                  "deletedConfigsCount",
                  "deletedUsers",
                  "updatedGlobalAdmins",
                ],
              },
            },
            required: ["message", "result"],
          },
          example: {
            message: "Tenant deleted successfully",
            result: {
              tenantId: "01234567-89ab-cdef-0123-456789abcdef",
              shortName: "acme-corp",
              deletedUsersCount: 3,
              updatedGlobalAdminsCount: 1,
              deletedConfigsCount: 12,
              deletedUsers: [
                {
                  id: "11111111-1111-1111-1111-111111111111",
                  email: "admin@acme.com",
                  role: "TENANT_ADMIN",
                },
                {
                  id: "22222222-2222-2222-2222-222222222222",
                  email: "staff1@acme.com",
                  role: "STAFF",
                },
                {
                  id: "33333333-3333-3333-3333-333333333333",
                  email: "staff2@acme.com",
                  role: "STAFF",
                },
              ],
              updatedGlobalAdmins: [
                {
                  id: "44444444-4444-4444-4444-444444444444",
                  email: "global@system.com",
                  role: "GLOBAL_ADMIN",
                },
              ],
            },
          },
        },
      },
    },
    "401": {
      description: "Authentication required",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Authentication required" },
        },
      },
    },
    "403": {
      description: "Insufficient permissions (only global admins can delete tenants)",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Insufficient permissions" },
        },
      },
    },
    "404": {
      description: "Tenant not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Tenant not found" },
        },
      },
    },
    "500": {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
          example: { error: "Internal server error" },
        },
      },
    },
  },
});

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;
    const body = await request.json();

    log.debug("Updating tenant metadata", {
      tenantId,
      updateFields: Object.keys(body),
    });

    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    checkPermission(locals, tenantId, true);

    const tenantService = await TenantAdminService.getTenantById(tenantId);
    const updatedTenant = await tenantService.updateTenantData(body);

    log.debug("Tenant metadata updated successfully", {
      tenantId,
      updateFields: Object.keys(body),
    });

    return json({
      message: "Tenant metadata updated successfully",
      tenant: updatedTenant,
    });
  } catch (error) {
    logError(log)("Error updating tenant metadata", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    // Handle unique constraint violation (shortName already exists)
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return new ConflictError(ERRORS.TENANTS.NAME_EXISTS).toJson();
    }

    return new InternalError().toJson();
  }
};

export const GET: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;

    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    log.debug("Getting tenant details", {
      tenantId,
      requestedBy: locals.user?.userId,
    });

    checkPermission(locals, tenantId, true);

    const tenantService = await TenantAdminService.getTenantById(tenantId);
    const tenantData = tenantService.tenantData;

    log.debug("Retrieved tenant data", { tenantService });

    if (!tenantData) {
      throw new NotFoundError(ERRORS.TENANTS.NOT_FOUND);
    }

    log.debug("Tenant details retrieved successfully", {
      tenantId,
      requestedBy: locals.user?.userId,
    });

    return json({
      tenant: tenantData,
    });
  } catch (error) {
    logError(log)("Error getting tenant details", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;

    // Check if user is authenticated
    checkPermission(locals, tenantId ?? null, true, true);

    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    log.info("Attempting tenant deletion", {
      tenantId,
      requestedBy: locals.user?.userId,
      userRole: locals.user?.role,
    });

    // Get tenant service and perform deletion
    const tenantService = await TenantAdminService.getTenantById(tenantId);
    const result = await tenantService.deleteTenant();

    log.info("Tenant deletion completed successfully", {
      tenantId,
      shortName: result.shortName,
      deletedUsersCount: result.deletedUsersCount,
      updatedGlobalAdminsCount: result.updatedGlobalAdminsCount,
      deletedConfigsCount: result.deletedConfigsCount,
      requestedBy: locals.user?.userId,
    });

    return json({
      message: "Tenant deleted successfully",
      result,
    });
  } catch (error) {
    logError(log)("Error deleting tenant", error, locals.user?.userId, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
