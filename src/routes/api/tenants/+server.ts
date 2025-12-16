import { json } from "@sveltejs/kit";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { BackendError, ConflictError, InternalError, logError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { db } from "$lib/server/db";
import { tenant } from "$lib/server/db/central-schema";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";
import { ERRORS } from "$lib/errors";

// Register OpenAPI documentation
registerOpenAPIRoute("/tenants", "POST", {
  summary: "Create a new tenant",
  description: "Creates a new tenant with initial configuration",
  tags: ["Tenants"],
  requestBody: {
    description: "Tenant creation data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            shortName: {
              type: "string",
              minLength: 4,
              maxLength: 15,
              description: "Short name for the tenant (4-15 characters)",
              example: "acme-corp",
            },
          },
          required: ["shortName"],
        },
      },
    },
  },
  responses: {
    "201": {
      description: "Tenant created successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              tenant: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Generated tenant ID" },
                  shortName: { type: "string", description: "Tenant short name" },
                },
                required: ["id", "shortName"],
              },
            },
            required: ["message", "tenant"],
          },
          example: {
            message: "Tenant created successfully",
            tenant: {
              id: "01234567-89ab-cdef-0123-456789abcdef",
              shortName: "acme-corp",
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
          example: { error: "Invalid tenant creation request" },
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
registerOpenAPIRoute("/tenants", "GET", {
  summary: "Get all tenant IDs",
  description: "Returns a list of all tenant IDs and basic information",
  tags: ["Tenants"],
  responses: {
    "200": {
      description: "List of all tenants",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              tenants: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid", description: "Tenant ID" },
                    shortName: { type: "string", description: "Tenant short name" },
                    longName: { type: "string", description: "Tenant long name" },
                    logo: { type: "string", format: "uri", description: "URL of the tenant logo" },
                    setupState: {
                      type: "string",
                      enum: ["NEW", "SETTINGS_CREATED", "AGENTS_SET_UP", "FIRST_CHANNEL_CREATED"],
                      description: "Current setup state",
                    },
                  },
                  required: ["id", "shortName", "setupState"],
                },
              },
            },
            required: ["tenants"],
          },
          example: {
            tenants: [
              {
                id: "01234567-89ab-cdef-0123-456789abcdef",
                shortName: "acme-corp",
                longName: "ACME Corporation",
                setupState: "FIRST_CHANNEL_CREATED",
              },
            ],
          },
        },
      },
    },
    "403": {
      description: "Insufficient permissions (Global Admin required)",
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

export const POST: RequestHandler = async ({ locals, request }) => {
  const log = logger.setContext("API");

  try {
    const body = await request.json();

    log.debug("Creating tenant", {
      shortName: body.shortName,
    });

    checkPermission(locals, null, true);

    const tenantService = await TenantAdminService.createTenant({
      shortName: body.shortName,
    });

    log.debug("Tenant created successfully", {
      tenantId: tenantService.tenantId,
      shortName: body.shortName,
    });

    return json(
      {
        message: "Tenant created successfully",
        tenant: {
          id: tenantService.tenantId,
          shortName: body.shortName,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logError(log)("Tenant creation error", error, locals.user?.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    if (error instanceof Error && error.message.includes("unique constraint")) {
      return new ConflictError(ERRORS.TENANTS.NAME_EXISTS).toJson();
    }

    return new InternalError().toJson();
  }
};

export const GET: RequestHandler = async ({ locals }) => {
  const log = logger.setContext("API");

  try {
    // Check if user is authenticated and is a global admin
    checkPermission(
      locals,
      locals.user?.role === "TENANT_ADMIN" ? locals.user.tenantId : null,
      true,
    );

    log.debug("Getting all tenants", {
      requestedBy: locals.user?.id,
    });

    // Get all tenants from database
    const tenants = await db
      .select({
        id: tenant.id,
        shortName: tenant.shortName,
        languages: tenant.languages,
        setupState: tenant.setupState,
        logo: tenant.logo,
      })
      .from(tenant)
      .orderBy(tenant.shortName);

    log.debug("Retrieved tenants successfully", {
      tenantCount: tenants.length,
      requestedBy: locals.user?.id,
    });

    return json({
      tenants: tenants,
    });
  } catch (error) {
    logError(log)("Error getting tenants", error, locals.user?.id);
    return new InternalError().toJson();
  }
};
