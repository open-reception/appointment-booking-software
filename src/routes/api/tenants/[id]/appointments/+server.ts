import { json } from "@sveltejs/kit";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

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
    const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
      throw new ValidationError("Date range cannot exceed 1 year");
    }

    log.debug("Getting appointments by time range", {
      tenantId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      requestedBy: locals.user?.userId,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const appointments = await appointmentService.getAppointmentsByTimeRange(startDate, endDate);

    log.debug("Appointments retrieved successfully", {
      tenantId,
      count: appointments.length,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      requestedBy: locals.user?.userId,
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
    logError(log)(
      "Error getting appointments by time range",
      error,
      locals.user?.userId,
      params.id,
    );

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
