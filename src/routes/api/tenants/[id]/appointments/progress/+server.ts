import { json } from "@sveltejs/kit";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/appointments/progress", "GET", {
  summary: "Get appointment progress states",
  description: "Retrieves all progress states that are possible on this tenant's appointments.",
  tags: ["Appointments", "Progress"],
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
      description: "Progress states retrieved successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              states: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid", description: "Progress state ID" },
                    state: {
                      type: "string",
                      description: "all caps value of the appointment progress",
                    },
                    icon: {
                      type: "string",
                      description: "Icon representing the overall progress state",
                      enum: ["NOT_STARTED", "WAITING", "IN_PROGRESS", "DONE"],
                    },
                    names: {
                      type: "string",
                      format: "date-time",
                      description: "Appointment date and time",
                    },
                    isLocked: {
                      type: "boolean",
                      description: "Indicates if the progress state is locked",
                    },
                  },
                  required: ["id", "state", "icon", "names", "isLocked"],
                },
              },
            },
            required: ["states"],
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

export const GET: RequestHandler = async ({ params, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;

    if (!tenantId) {
      throw new ValidationError("Tenant ID is required");
    }

    checkPermission(locals, tenantId, false);

    log.debug("Getting appointment progress states", {
      tenantId,
      requestedBy: locals.user?.id,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const states = await appointmentService.getAppointmentProgressStates();

    log.debug("Appointment progress states retrieved successfully", {
      tenantId,
      count: states.length,
      requestedBy: locals.user?.id,
    });

    return json({
      states,
    });
  } catch (error) {
    logError(log)("Error getting appointment progress states", error, locals.user?.id, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
