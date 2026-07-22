import { ERRORS } from "$lib/errors";
import { logger } from "$lib/logger";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UserService } from "$lib/server/services/user-service";
import { BackendError, InternalError, logError, ValidationError } from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/staff/{staffId}/resend-invite", "POST", {
  summary: "Resend invite for staff member",
  description:
    "Resends an e-mail invite to a staff member that has not confirmed their account yet. Requires administrative permissions.",
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
    description: "Empty body",
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
  responses: {
    "200": {
      description: "Staff member successfully re-invited",
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

export const POST: RequestHandler = async ({ params, locals, request, url }) => {
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
    const body = await request.json();
    await UserService.resendConfirmationEmail(body.email, url);

    log.debug("Invite to staff member was sent", { staffId, tenantId });
    return json({});
  } catch (error) {
    logError(log)(
      "Error resending invite e-mail to staff member",
      error,
      locals.user?.id,
      params.id,
    );

    if (error instanceof BackendError) {
      return error.toJson();
    }

    return new InternalError().toJson();
  }
};
