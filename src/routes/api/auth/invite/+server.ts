import { json } from "@sveltejs/kit";
import { z } from "zod";
import type { RequestHandler } from "./$types";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import { UniversalLogger } from "$lib/logger";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { InviteService } from "$lib/server/services/invite-service";
import { sendUserInviteEmail } from "$lib/server/email/email-service";
import { env } from "$env/dynamic/private";

const logger = new UniversalLogger().setContext("AuthInviteAPI");

const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["TENANT_ADMIN", "STAFF"]),
  tenantId: z.string().uuid(),
  language: z.enum(["de", "en"]).optional().default("en"),
});

registerOpenAPIRoute("/auth/invite", "POST", {
  summary: "Invite user to tenant",
  description:
    "Send an invitation email to a user to join an existing tenant with a specific role (not for initial tenant admin!)",
  tags: ["Authentication"],
  requestBody: {
    description: "User invitation data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "Email address of the user to invite",
              example: "user@example.com",
            },
            name: {
              type: "string",
              description: "Full name of the user to invite",
              example: "John Doe",
            },
            role: {
              type: "string",
              enum: ["TENANT_ADMIN", "STAFF"],
              description: "Role to assign to the invited user",
              example: "STAFF",
            },
            tenantId: {
              type: "string",
              format: "uuid",
              description: "ID of the tenant to invite the user to",
              example: "01234567-89ab-cdef-0123-456789abcdef",
            },
            language: {
              type: "string",
              enum: ["de", "en"],
              description: "Language for the invitation email",
              example: "de",
              default: "de",
            },
          },
          required: ["email", "name", "role", "tenantId"],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Invitation sent successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string", description: "Success message" },
              email: { type: "string", description: "Email address invitation was sent to" },
              tenantId: { type: "string", description: "Tenant ID" },
              role: { type: "string", description: "Assigned role" },
            },
            required: ["message", "email", "tenantId", "role"],
          },
        },
      },
    },
    "400": {
      description: "Invalid request data",
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

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    // Verify user is authenticated
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const validation = inviteUserSchema.safeParse(body);

    if (!validation.success) {
      logger.warn("Invalid invite request", {
        userId: locals.user.id,
        errors: validation.error.issues,
      });
      throw new ValidationError("Invalid request data");
    }

    const { email, name, role, tenantId, language } = validation.data;

    // Check if user has permission to invite to this tenant
    // Global admins can invite to any tenant
    // Tenant admins can only invite to their own tenant
    if (locals.user.role === "GLOBAL_ADMIN") {
      // Global admin can invite to any tenant
    } else if (locals.user.role === "TENANT_ADMIN" && locals.user.tenantId === tenantId) {
      // Tenant admin can invite to their own tenant
    } else {
      logger.warn("Insufficient permissions for invitation", {
        userId: locals.user.id,
        userRole: locals.user.role,
        userTenantId: locals.user.tenantId,
        targetTenantId: tenantId,
      });
      return json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get tenant information
    let tenantService;
    try {
      tenantService = await TenantAdminService.getTenantById(tenantId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return json({ error: "Tenant not found" }, { status: 404 });
      }
      throw error;
    }

    const tenant = tenantService.tenantData;
    if (!tenant) {
      return json({ error: "Tenant not found" }, { status: 404 });
    }

    // Check if user already has a pending invitation for this tenant
    const hasPendingInvite = await InviteService.hasPendingInvite(email, tenantId);
    if (hasPendingInvite) {
      return json(
        { error: "User already has a pending invitation for this tenant" },
        { status: 409 },
      );
    }

    // Create invitation in database
    const invitation = await InviteService.createInvite(
      email,
      name,
      role,
      tenantId,
      locals.user.id,
      language,
    );

    // Generate registration URL with secure invite code
    const registrationUrl = `${env.PUBLIC_APP_URL || "http://localhost:5173"}/confirm/${invitation.inviteCode}`;

    // Send invitation email
    await sendUserInviteEmail(email, name, tenant, role, registrationUrl, language);

    logger.info("User invitation sent successfully", {
      invitedBy: locals.user.id,
      invitedEmail: email,
      tenantId,
      role,
    });

    return json({
      message: "Invitation sent successfully",
      email,
      tenantId,
      role,
      inviteCode: invitation.inviteCode,
    });
  } catch (error) {
    logger.error("User invitation error:", {
      error: String(error),
      userId: locals.user?.id,
    });

    if (error instanceof ValidationError) {
      return json({ error: error.message }, { status: 400 });
    }

    return json({ error: "Internal server error" }, { status: 500 });
  }
};
