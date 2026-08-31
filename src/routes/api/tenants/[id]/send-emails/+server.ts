import { EMAIL_TYPE } from "$lib/const/email";
import { ERRORS } from "$lib/errors";
import { logger } from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import {
  AuthenticationError,
  AuthorizationError,
  BackendError,
  InternalError,
  logError,
  ValidationError,
} from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { z } from "zod";

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/send-emails", "POST", {
  summary: "Send email endpoint for staff members",
  description:
    "Sends a list of emails as a batch operation. Only staff and tenant admins can send emails. Used for appointment reminders.",
  tags: ["E-Mails", "Appointments"],
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
    description: "List of emails to be sent",
    content: {
      "application/json": {
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["APPOINTMENT_REMINDER"] },
              appointment: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  locale: { type: "string" },
                },
                required: ["id", "name", "email", "locale"],
              },
            },
            required: ["type", "appointment"],
          },
        },
      },
    },
  },
  responses: {
    "201": {
      description: "E-Mails successfully sent",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {},
            required: [],
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
      description: "Proper role required",
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

const emailSendingSchema = z.object({
  emails: z.array(
    z.object({
      type: z.enum(EMAIL_TYPE),
      appointment: z.object({
        id: z.uuid(),
        name: z.string(),
        email: z.email(),
        locale: z.string(),
      }),
    }),
  ),
});

export const POST: RequestHandler = async ({ params, locals, request }) => {
  const log = logger.setContext("API");
  const tenantId = params.id;
  const user = locals.user;

  if (!user) {
    throw new AuthenticationError();
  }

  if (!user.tenantId || !tenantId) {
    throw new ValidationError(ERRORS.TENANTS.NO_TENANT_ID);
  }

  checkPermission(locals, tenantId, true);

  if (!["STAFF", "TENANT_ADMIN"].includes(locals.user?.role || "")) {
    throw new AuthorizationError("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const validation = emailSendingSchema.safeParse(body);
    if (!validation.success) {
      throw new ValidationError("Invalid email queue data");
    }

    // Get tenant
    const tenantAdminService = await TenantAdminService.getTenantById(user.tenantId);
    const tenant = tenantAdminService.tenantData;
    if (!tenant) {
      throw new BackendError("Tenant not found", 500);
    }

    // Get appointment service ready
    const appointmentService = await AppointmentService.forTenant(tenantId);

    // Send emails
    const sentEmails = validation.data.emails.map(async (email) => {
      const appointment = await appointmentService.getAppointmentById(email.appointment.id);
      switch (email.type) {
        case EMAIL_TYPE.APPOINTMENT_REMINDER:
          await appointmentService.sendAppointmentReminder(tenant, appointment.id, {
            email: email.appointment.email,
            name: email.appointment.name,
            locale: email.appointment.locale,
          });
          break;
        default:
          throw new ValidationError(`Unsupported email type: ${email.type}`);
      }
    });
    await Promise.all(sentEmails);

    log.debug("E-Mails successfully sent", { tenantId });
    return json({});
  } catch (error) {
    logError(log)("Error sending e-mails", error, locals.user?.id, params.id);

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
