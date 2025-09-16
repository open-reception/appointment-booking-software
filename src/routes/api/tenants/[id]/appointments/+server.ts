import { json } from "@sveltejs/kit";
import { AppointmentService } from "$lib/server/services/appointment-service";
import {
  BackendError,
  ConflictError,
  InternalError,
  logError,
  ValidationError,
} from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";
import { ERRORS } from "$lib/errors";

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/appointments", "POST", {
  summary: "Create a new appointment",
  description:
    "Creates a new appointment for a specific tenant. Only global admins, tenant admins, and staff can create appointments for existing clients.",
  tags: ["Appointments"],
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
    description: "Appointment creation data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            clientId: {
              type: "string",
              format: "uuid",
              description: "Client ID (client must already exist)",
            },
            channelId: {
              type: "string",
              format: "uuid",
              description: "Channel ID",
            },
            appointmentDate: {
              type: "string",
              format: "date-time",
              description: "Appointment date and time",
            },
            expiryDate: {
              type: "string",
              format: "date",
              description: "When appointment data expires",
            },
            title: {
              type: "string",
              minLength: 1,
              maxLength: 200,
              description: "Appointment title",
            },
            description: {
              type: "string",
              description: "Appointment description",
            },
            status: {
              type: "string",
              enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"],
              description: "Appointment status",
              default: "NEW",
            },
          },
          required: ["clientId", "channelId", "appointmentDate", "expiryDate", "title"],
        },
      },
    },
  },
  responses: {
    "201": {
      description: "Appointment created successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              appointment: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid", description: "Appointment ID" },
                  clientId: { type: "string", format: "uuid", description: "Client ID" },
                  channelId: { type: "string", format: "uuid", description: "Channel ID" },
                  appointmentDate: {
                    type: "string",
                    format: "date-time",
                    description: "Appointment date",
                  },
                  expiryDate: { type: "string", format: "date", description: "Expiry date" },
                  title: { type: "string", description: "Appointment title" },
                  description: { type: "string", description: "Appointment description" },
                  status: {
                    type: "string",
                    enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"],
                  },
                },
                required: [
                  "id",
                  "clientId",
                  "channelId",
                  "appointmentDate",
                  "expiryDate",
                  "title",
                  "status",
                ],
              },
            },
            required: ["message", "appointment"],
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
      description: "Tenant, client, or channel not found",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "409": {
      description: "Appointment conflict or channel paused",
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

// Register OpenAPI documentation for GET
registerOpenAPIRoute("/tenants/{id}/appointments", "GET", {
  summary: "List appointments",
  description:
    "Retrieves appointments for a specific tenant with optional filters. Global admins, tenant admins, and staff can view appointments.",
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
      description: "Start date for appointment search",
    },
    {
      name: "endDate",
      in: "query",
      required: true,
      schema: { type: "string", format: "date-time" },
      description: "End date for appointment search",
    },
    {
      name: "channelId",
      in: "query",
      schema: { type: "string", format: "uuid" },
      description: "Filter by channel ID",
    },
    {
      name: "clientId",
      in: "query",
      schema: { type: "string", format: "uuid" },
      description: "Filter by client ID",
    },
    {
      name: "status",
      in: "query",
      schema: { type: "string", enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"] },
      description: "Filter by appointment status",
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
                    clientId: { type: "string", format: "uuid", description: "Client ID" },
                    channelId: { type: "string", format: "uuid", description: "Channel ID" },
                    appointmentDate: {
                      type: "string",
                      format: "date-time",
                      description: "Appointment date",
                    },
                    expiryDate: { type: "string", format: "date", description: "Expiry date" },
                    title: { type: "string", description: "Appointment title" },
                    description: { type: "string", description: "Appointment description" },
                    status: {
                      type: "string",
                      enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"],
                    },
                    client: {
                      type: "object",
                      description: "Client details",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        hashKey: { type: "string" },
                        email: { type: "string" },
                      },
                    },
                    channel: {
                      type: "object",
                      description: "Channel details",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        names: { type: "array", items: { type: "string" } },
                        color: { type: "string" },
                      },
                    },
                  },
                  required: [
                    "id",
                    "clientId",
                    "channelId",
                    "appointmentDate",
                    "expiryDate",
                    "title",
                    "status",
                  ],
                },
              },
            },
            required: ["appointments"],
          },
        },
      },
    },
    "400": {
      description: "Invalid query parameters",
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

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;

    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    checkPermission(locals, tenantId);

    const body = await request.json();

    log.debug("Creating new appointment", {
      tenantId,
      requestedBy: locals.user?.userId,
      clientId: body.clientId,
      channelId: body.channelId,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const newAppointment = await appointmentService.createAppointment(body);

    log.debug("Appointment created successfully", {
      tenantId,
      appointmentId: newAppointment.id,
      requestedBy: locals.user?.userId,
    });

    return json(
      {
        message: "Appointment created successfully",
        appointment: newAppointment,
      },
      { status: 201 },
    );
  } catch (error) {
    logError(log)("Error creating appointment", error, locals.user?.userId, params.id);
    if (error instanceof BackendError) {
      return error.toJson();
    }

    if (
      (error instanceof Error && error.message.includes("conflict")) ||
      (error instanceof Error && error.message.includes("paused"))
    ) {
      return new ConflictError(error.message).toJson();
    }

    return new InternalError().toJson();
  }
};

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const log = logger.setContext("API");

  try {
    const tenantId = params.id;

    if (!tenantId) {
      throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
    }

    checkPermission(locals, tenantId);

    // Extract query parameters
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const channelId = url.searchParams.get("channelId");
    const clientId = url.searchParams.get("clientId");
    const status = url.searchParams.get("status");

    if (!startDate || !endDate) {
      throw new ValidationError("startDate and endDate are required");
    }

    const query = {
      startDate,
      endDate,
      ...(channelId && { channelId }),
      ...(clientId && { clientId }),
      ...(status && { status: status as "NEW" | "CONFIRMED" | "HELD" | "REJECTED" | "NO_SHOW" }),
    };

    log.debug("Getting appointments", {
      tenantId,
      requestedBy: locals.user?.userId,
      query,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);
    const appointments = await appointmentService.queryAppointments(query);

    log.debug("Appointments retrieved successfully", {
      tenantId,
      count: appointments.length,
      requestedBy: locals.user?.userId,
    });

    return json({
      appointments,
    });
  } catch (error) {
    logError(log)("Error getting appointments", error, locals.user?.userId, params.id);
    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
