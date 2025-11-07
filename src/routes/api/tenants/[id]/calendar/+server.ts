import { json } from "@sveltejs/kit";
import { ScheduleService } from "$lib/server/services/schedule-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/calendar", "GET", {
  summary: "Get tenant calendar",
  description:
    "Retrieves the appointment calendar for a specific tenant within a date range. Shows available time slots, existing appointments, and agent availability. This is a public endpoint that doesn't require authentication.",
  tags: ["Calendar", "Public"],
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
      description: "Start date for the calendar range (ISO 8601 format with timezone)",
    },
    {
      name: "endDate",
      in: "query",
      required: true,
      schema: { type: "string", format: "date-time" },
      description: "End date for the calendar range (ISO 8601 format with timezone)",
    },
  ],
  responses: {
    "200": {
      description: "Calendar retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              period: {
                type: "object",
                properties: {
                  startDate: {
                    type: "string",
                    format: "date-time",
                    description: "Query start date",
                  },
                  endDate: {
                    type: "string",
                    format: "date-time",
                    description: "Query end date",
                  },
                },
                required: ["startDate", "endDate"],
              },
              calendar: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: {
                      type: "string",
                      format: "date",
                      description: "Date in YYYY-MM-DD format",
                    },
                    channels: {
                      type: "object",
                      description:
                        "Calendar data organized by channel ID (key-value pairs where key is channel UUID and value contains channel info, appointments, and available slots)",
                    },
                  },
                },
                description: "Daily calendar data",
              },
            },
            required: ["period", "calendar"],
          },
        },
      },
    },
    "400": {
      description: "Invalid request parameters",
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

export const GET: RequestHandler = async ({ params, url }) => {
  const log = logger.setContext("CalendarAPI");

  try {
    const tenantId = params.id;

    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }

    // Parse query parameters for date range
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    if (!startDateParam || !endDateParam) {
      throw new ValidationError("Both startDate and endDate query parameters are required");
    }

    // Validate date format (ISO 8601 with timezone)
    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new ValidationError(
        "Invalid date format. Use ISO 8601 format with timezone (YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ss±HH:mm)",
      );
    }

    if (startDate > endDate) {
      throw new ValidationError("Start date must be before end date");
    }

    // Limit the time range to prevent excessive queries (max 3 months)
    const maxRangeMs = 91 * 24 * 60 * 60 * 1000; // ~3 months in milliseconds (91 days to be safe)
    if (endDate.getTime() - startDate.getTime() >= maxRangeMs) {
      throw new ValidationError("Date range cannot exceed 90 days");
    }

    log.debug("Getting calendar for tenant", {
      tenantId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const scheduleService = await ScheduleService.forTenant(tenantId);
    const schedule = await scheduleService.getSchedule({
      tenantId,
      startDate: startDateParam,
      endDate: endDateParam,
    });

    // Return full calendar data (including appointments and detailed agent info)
    const result = {
      period: schedule.period,
      calendar: schedule.schedule,
    };

    log.debug("Calendar retrieved successfully", {
      tenantId,
      daysCount: schedule.schedule.length,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    return json(result);
  } catch (error) {
    logError(log)("Error getting calendar", error, undefined, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
