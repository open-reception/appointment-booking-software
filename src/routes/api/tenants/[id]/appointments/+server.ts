import { json } from "@sveltejs/kit";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/appointments", "GET", {
  summary: "Get appointments by time range",
  description:
    "Retrieves all appointments within a specified time range for a tenant. Only staff and tenant admins can access appointments.",
  tags: ["Appointments"],
  parameters: [
    {
      name: "id",
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
      description: "Tenant ID",
    },
    {
      name: "startDate",
      in: "query",
      required: true,
      schema: { type: "string", format: "date-time" },
      description: "Start date for the time range (ISO 8601 format: 2024-01-01T00:00:00.000Z)",
    },
    {
      name: "endDate",
      in: "query",
      required: true,
      schema: { type: "string", format: "date-time" },
      description: "End date for the time range (ISO 8601 format: 2024-12-31T23:59:59.999Z)",
    },
  ],
  responses: {
    "200": {
      description: "Appointments retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              appointments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid", description: "Appointment ID" },
                    tunnelId: { type: "string", format: "uuid", description: "Client tunnel ID" },
                    channelId: { type: "string", format: "uuid", description: "Channel ID" },
                    appointmentDate: {
                      type: "string",
                      format: "date-time",
                      description: "Appointment date and time",
                    },
                    expiryDate: {
                      type: "string",
                      format: "date",
                      description: "Data expiry date (nullable)",
                    },
                    status: {
                      type: "string",
                      enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"],
                      description: "Appointment status",
                    },
                    encryptedPayload: {
                      type: "string",
                      description: "Encrypted appointment data (nullable)",
                    },
                    iv: {
                      type: "string",
                      description: "Initialization vector for encryption (nullable)",
                    },
                    authTag: {
                      type: "string",
                      description: "Authentication tag for encryption (nullable)",
                    },
                    createdAt: {
                      type: "string",
                      format: "date-time",
                      description: "Creation timestamp (nullable)",
                    },
                    updatedAt: {
                      type: "string",
                      format: "date-time",
                      description: "Last update timestamp (nullable)",
                    },
                  },
                  required: ["id", "tunnelId", "channelId", "appointmentDate", "status"],
                },
              },
              meta: {
                type: "object",
                properties: {
                  count: { type: "number", description: "Number of appointments found" },
                  startDate: {
                    type: "string",
                    format: "date-time",
                    description: "Query start date",
                  },
                  endDate: { type: "string", format: "date-time", description: "Query end date" },
                },
                required: ["count", "startDate", "endDate"],
              },
            },
            required: ["appointments", "meta"],
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

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;

    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }

    // Check permissions - only STAFF and TENANT_ADMIN can access appointments
    checkPermission(locals, tenantId, false);

    // Parse query parameters for date range
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    if (!startDateParam || !endDateParam) {
      throw new ValidationError("Both startDate and endDate query parameters are required");
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ValidationError(
        "Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
      );
    }

    if (startDate >= endDate) {
      throw new ValidationError("Start date must be before end date");
    }

    // Limit the time range to prevent excessive queries (max 1 year)
    const maxRangeMs = 366 * 24 * 60 * 60 * 1000; // 1 year in milliseconds (accounting for leap years)
    if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
      throw new ValidationError("Date range cannot exceed 1 year");
    }

    log.debug("Getting appointments by time range", {
      tenantId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      requestedBy: locals.user?.id,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const appointments = await appointmentService.getAppointmentsByTimeRange(startDate, endDate);

    log.debug("Appointments retrieved successfully", {
      tenantId,
      count: appointments.length,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      requestedBy: locals.user?.id,
    });

    return json({
      appointments,
      meta: {
        count: appointments.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  } catch (error) {
    logError(log)("Error getting appointments by time range", error, locals.user?.id, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
