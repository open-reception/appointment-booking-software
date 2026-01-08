import { json, type RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { logger } from "$lib/logger";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { ClientPinResetService } from "$lib/server/services/client-pin-reset-service";
import { checkPermission } from "$lib/server/utils/permissions";
import { ValidationError, BackendError, logError, ConflictError } from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";

const requestSchema = z
  .object({
    // Client identification
    clientEmail: z.email().optional(),
    hasNoEmail: z.boolean().optional(),
    emailHash: z.string(),

    // Appointment details
    appointmentDate: z.string(),
    duration: z.number().int().positive(),
    channelId: z.string(),
    agentId: z.string(),

    // Crypto data for new client
    tunnelId: z.string().optional(),
    clientPublicKey: z.string().optional(),
    privateKeyShare: z.string().optional(),
    clientEncryptedTunnelKey: z.string().optional(),
    staffKeyShares: z
      .array(
        z.object({
          userId: z.string(),
          encryptedTunnelKey: z.string(),
        }),
      )
      .optional(),

    // Encrypted appointment data
    encryptedAppointment: z.object({
      encryptedPayload: z.string(),
      iv: z.string(),
      authTag: z.string(),
    }),

    // Client preferences
    clientLanguage: z.string().optional().default("de"),
    sendEmail: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      // If sendEmail is true, clientEmail is required (unless hasNoEmail is true)
      if (data.sendEmail && !data.hasNoEmail && !data.clientEmail) {
        return false;
      }
      return true;
    },
    {
      message: "clientEmail is required when sendEmail is true (unless hasNoEmail is set)",
    },
  );

// Register OpenAPI documentation for POST
registerOpenAPIRoute("/tenants/{id}/appointments/staff-create", "POST", {
  summary: "Staff creates appointment for client",
  description:
    "Allows staff members to create appointments on behalf of clients. Supports both existing clients (by email) and new clients (with or without email).\n\n" +
    "**Client-Side Encryption Required**: All appointment data must be encrypted client-side before sending to this endpoint. " +
    "The staff member's frontend application must:\n" +
    "1. For new clients: Generate a new tunnel with keys and encrypt the appointment data\n" +
    "2. For existing clients: Decrypt the staff key share to access the tunnel key, then encrypt the appointment data\n\n" +
    "**Workflow for new clients with email**:\n" +
    "1. Staff creates appointment with encrypted data\n" +
    "2. Backend stores the appointment and automatically initiates PIN reset flow\n" +
    "3. Client receives email with PIN reset link\n" +
    "4. Client sets their PIN and gains access to the appointment\n\n" +
    "**Workflow for new clients without email**:\n" +
    "1. Staff creates appointment with encrypted data and `hasNoEmail: true`\n" +
    "2. Backend stores the appointment without PIN reset\n" +
    "3. Client must visit practice in person to access their appointment\n\n" +
    "**Workflow for existing clients**:\n" +
    "1. Staff checks if client exists (email hash)\n" +
    "2. Staff decrypts their staff key share to get tunnel key\n" +
    "3. Staff encrypts new appointment with tunnel key\n" +
    "4. Backend adds appointment to existing tunnel\n" +
    "5. Optionally sends email notification to client\n\n" +
    "Requires staff permissions.",
  tags: ["Appointments", "Staff"],
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
    description: "Staff appointment creation data",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            clientEmail: {
              type: "string",
              format: "email",
              description:
                "Client's email address. Only required if sendEmail is true and hasNoEmail is false. Used for sending appointment confirmation and PIN reset emails.",
            },
            hasNoEmail: {
              type: "boolean",
              description: "Set to true if client has no email address",
            },
            emailHash: {
              type: "string",
              description: "SHA-256 hash of client email or unique identifier",
            },
            appointmentDate: {
              type: "string",
              format: "date-time",
              description: "Appointment date and time (ISO 8601)",
            },
            duration: {
              type: "number",
              description: "Appointment duration in minutes",
            },
            channelId: {
              type: "string",
              format: "uuid",
              description: "Channel ID",
            },
            agentId: {
              type: "string",
              format: "uuid",
              description: "Agent ID",
            },
            tunnelId: {
              type: "string",
              format: "uuid",
              description: "Tunnel ID (for new clients)",
            },
            clientPublicKey: {
              type: "string",
              description: "Client's public key (for new clients)",
            },
            privateKeyShare: {
              type: "string",
              description: "Server share of private key (for new clients)",
            },
            clientEncryptedTunnelKey: {
              type: "string",
              description: "Tunnel key encrypted for client (for new clients)",
            },
            staffKeyShares: {
              type: "array",
              description: "Tunnel key shares for staff members (for new clients)",
              items: {
                type: "object",
                properties: {
                  userId: { type: "string", format: "uuid" },
                  encryptedTunnelKey: { type: "string" },
                },
              },
            },
            encryptedAppointment: {
              type: "object",
              description: "Encrypted appointment data",
              properties: {
                encryptedPayload: { type: "string" },
                iv: { type: "string" },
                authTag: { type: "string" },
              },
            },
            clientLanguage: {
              type: "string",
              description: "Client's preferred language",
              default: "de",
            },
            sendEmail: {
              type: "boolean",
              description: "Whether to send appointment confirmation email",
              default: false,
            },
          },
          required: [
            "emailHash",
            "appointmentDate",
            "duration",
            "channelId",
            "agentId",
            "encryptedAppointment",
          ],
        },
      },
    },
  },
  responses: {
    "200": {
      description: "Appointment created successfully",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                format: "uuid",
                description: "Created appointment ID",
              },
              appointmentDate: {
                type: "string",
                format: "date-time",
              },
              status: {
                type: "string",
                enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"],
              },
              isNewClient: {
                type: "boolean",
                description: "Whether this was a new client",
              },
              pinResetToken: {
                type: "string",
                description: "PIN reset token (only for new clients with email)",
              },
            },
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
      description: "Staff permissions required",
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

/**
 * POST /api/tenants/[id]/appointments/staff-create
 *
 * Staff creates appointment for client
 * - Checks if client exists (by emailHash)
 * - For existing clients: adds appointment to tunnel
 * - For new clients: creates tunnel and first appointment
 * - For new clients with email: initiates PIN reset flow
 * - Optionally sends appointment confirmation email
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const tenantId = params.id!;

  try {
    logger.debug("Staff appointment creation request", { tenantId, userId: locals.user?.id });

    // Check permissions - authenticated staff can create appointments for clients
    await checkPermission(locals, tenantId);

    // Parse and validate request
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    logger.debug("Request validated", {
      tenantId,
      shouldSendEmail: !!validatedData.clientEmail,
      hasNoEmail: validatedData.hasNoEmail,
    });

    const appointmentService = await AppointmentService.forTenant(tenantId);

    // Check if client already exists
    const tunnels = await appointmentService.getClientTunnels();
    const existingTunnel = tunnels.find((t) => t.emailHash === validatedData.emailHash);

    let result;
    let isNewClient = false;
    let pinResetToken: string | undefined;

    if (existingTunnel) {
      // Existing client - add appointment to existing tunnel
      logger.debug("Adding appointment to existing client tunnel", {
        tenantId,
        tunnelId: existingTunnel.id,
      });

      // Prepare data for existing client
      const appointmentData = {
        emailHash: validatedData.emailHash,
        tunnelId: existingTunnel.id,
        channelId: validatedData.channelId,
        agentId: validatedData.agentId,
        appointmentDate: validatedData.appointmentDate,
        duration: validatedData.duration,
        clientEmail: validatedData.clientEmail || "",
        clientLanguage: validatedData.clientLanguage,
        encryptedAppointment: validatedData.encryptedAppointment,
      };

      result = await appointmentService.addAppointmentToTunnel(appointmentData);
    } else {
      // New client - create tunnel and appointment
      isNewClient = true;
      logger.debug("Creating new client tunnel with appointment", {
        tenantId,
        hasEmail: !!validatedData.clientEmail,
      });

      // Validate required fields for new client
      if (
        !validatedData.tunnelId ||
        !validatedData.clientPublicKey ||
        !validatedData.privateKeyShare ||
        !validatedData.clientEncryptedTunnelKey ||
        !validatedData.staffKeyShares
      ) {
        throw new ValidationError(
          "Missing required crypto data for new client: tunnelId, clientPublicKey, privateKeyShare, clientEncryptedTunnelKey, staffKeyShares",
        );
      }

      // Prepare data for new client
      const clientData = {
        tunnelId: validatedData.tunnelId,
        channelId: validatedData.channelId,
        agentId: validatedData.agentId,
        appointmentDate: validatedData.appointmentDate,
        duration: validatedData.duration,
        emailHash: validatedData.emailHash,
        clientEmail: validatedData.clientEmail || "",
        clientLanguage: validatedData.clientLanguage,
        clientPublicKey: validatedData.clientPublicKey,
        privateKeyShare: validatedData.privateKeyShare,
        encryptedAppointment: validatedData.encryptedAppointment,
        staffKeyShares: validatedData.staffKeyShares,
        clientEncryptedTunnelKey: validatedData.clientEncryptedTunnelKey,
      };

      result = await appointmentService.createNewClientWithAppointment(clientData);

      // For new clients with email: initiate PIN reset flow
      if (validatedData.clientEmail && !validatedData.hasNoEmail) {
        try {
          logger.debug("Initiating PIN reset for new client", {
            tenantId,
            emailHash: validatedData.emailHash.slice(0, 8),
          });

          const pinResetService = await ClientPinResetService.forTenant(tenantId);
          // Use longer expiration for email-based reset (60 minutes)
          pinResetToken = await pinResetService.createResetToken(validatedData.emailHash, 60);

          logger.info("PIN reset token created for new client", {
            tenantId,
            tokenId: pinResetToken.slice(0, 8),
          });
        } catch (error) {
          logger.error("Failed to create PIN reset token for new client", {
            tenantId,
            error: String(error),
          });
          // Don't fail the appointment creation if PIN reset fails
          // Staff can manually initiate it later
        }
      }
    }

    // Send email notification if requested and client has email
    if (validatedData.sendEmail && validatedData.clientEmail && !validatedData.hasNoEmail) {
      try {
        await appointmentService.sendAppointmentNotification(
          result.id,
          validatedData.channelId,
          validatedData.clientEmail,
          validatedData.clientLanguage,
          !!result.requiresConfirmation,
        );
      } catch (error) {
        logger.error("Failed to send appointment notification", {
          tenantId,
          appointmentId: result.id,
          error: String(error),
        });
        // Don't fail the request if email sending fails
      }
    }

    logger.info("Staff appointment created successfully", {
      tenantId,
      appointmentId: result.id,
      isNewClient,
      hasPinReset: !!pinResetToken,
    });

    return json({
      id: result.id,
      appointmentDate: result.appointmentDate,
      status: result.status,
      isNewClient,
      pinResetToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Validation error in staff appointment creation", {
        tenantId,
        error,
      });
      const firstIssue = error.issues[0];
      const errorMessage = firstIssue?.message || "Invalid request data";
      return json({ error: errorMessage, details: error }, { status: 400 });
    }

    if (error instanceof ValidationError) {
      logger.warn("Validation error", { tenantId, error: error.message });
      return json({ error: error.message }, { status: 400 });
    }

    if (error instanceof ConflictError) {
      logger.warn("Conflict error", { tenantId, error: error.message });
      return json({ error: error.message }, { status: 409 });
    }

    logError(logger)("General error:", error as BackendError, "staff-create-appointment", tenantId);
    return json({ error: "Failed to create appointment" }, { status: 500 });
  }
};
