import { getTenantDb, centralDb } from "../db";
import * as tenantSchema from "../db/tenant-schema";
import { type SelectAppointment } from "../db/tenant-schema";
import * as centralSchema from "../db/central-schema";
import logger from "$lib/logger";
import { ValidationError, NotFoundError, InternalError, ConflictError } from "../utils/errors";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import type { AppointmentResponse } from "$lib/types/appointment";
import {
  sendAppointmentCreatedEmail,
  sendAppointmentRequestEmail,
  sendAppointmentCancelledEmail,
  getChannelTitle,
  sendAppointmentRejectedEmail,
} from "../email/email-service";
import { TenantAdminService } from "./tenant-admin-service";
import { NotificationService } from "./notification-service";
import { challengeStore } from "./challenge-store";
import { challengeThrottleService } from "./challenge-throttle";
import { timingSafeEqual } from "node:crypto";

export interface ClientTunnelData {
  tunnelId: string;
  channelId: string;
  agentId: string;
  appointmentDate: string;
  duration: number;
  emailHash: string;
  clientEmail?: string;
  clientLanguage?: string;
  clientPublicKey: string;
  privateKeyShare: string;
  encryptedAppointment: {
    encryptedPayload: string;
    iv: string;
    authTag: string;
  };
  staffKeyShares: {
    userId: string;
    encryptedTunnelKey: string;
  }[];
  clientEncryptedTunnelKey: string;
}

export interface ClientTunnelResponse {
  id: string;
  emailHash: string;
  clientPublicKey: string;
  clientEncryptedTunnelKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class AppointmentService {
  #db: Awaited<ReturnType<typeof getTenantDb>> | null = null;

  private constructor(public readonly tenantId: string) {}

  /**
   * Create an appointment service for a specific tenant
   * @param tenantId The ID of the tenant
   * @returns new AppointmentService instance
   */
  static async forTenant(tenantId: string) {
    const log = logger.setContext("AppointmentService");
    log.debug("Creating appointment service for tenant", { tenantId });

    try {
      const service = new AppointmentService(tenantId);
      service.#db = await getTenantDb(tenantId);

      log.debug("Appointment service created successfully", { tenantId });
      return service;
    } catch (error) {
      log.error("Failed to create appointment service", { tenantId, error: String(error) });
      throw error;
    }
  }

  /**
   * Send appointment notification email to client
   * @param appointmentId - The appointment ID
   * @param channelId - The channel ID
   * @param clientEmail - Client's email address
   * @param clientLanguage - Client's preferred language
   * @param requiresConfirmation - Whether the appointment requires staff confirmation
   */
  async sendAppointmentNotification(
    appointmentId: string,
    channelId: string,
    clientEmail: string,
    clientLanguage: string,
    requiresConfirmation: boolean,
  ): Promise<void> {
    const log = logger.setContext("AppointmentService");
    log.debug("Sending appointment notification", {
      appointmentId,
      clientEmail,
      requiresConfirmation,
      tenantId: this.tenantId,
    });

    try {
      // Get tenant information
      const tenantService = await TenantAdminService.getTenantById(this.tenantId);
      const tenant = tenantService.tenantData;

      if (!tenant) {
        log.warn("Cannot send email: Tenant not found", { tenantId: this.tenantId });
        return;
      }

      // Get full appointment data
      const appointment = await this.getAppointmentById(appointmentId);

      // Create client data object
      const clientData = {
        email: clientEmail,
        language: clientLanguage,
      };

      // Get channel title for the email
      const channelTitle = await getChannelTitle(this.tenantId, channelId, clientLanguage);

      // Send appropriate email based on whether confirmation is required
      if (requiresConfirmation) {
        await sendAppointmentRequestEmail(clientData, tenant, appointment, channelTitle);
        log.info("Appointment request email sent", {
          appointmentId: appointment.id,
          tenantId: this.tenantId,
        });
      } else if (appointment.status === "REJECTED") {
        await sendAppointmentRejectedEmail(clientData, tenant, appointment, channelTitle);
      } else {
        await sendAppointmentCreatedEmail(clientData, tenant, appointment, channelTitle);
        log.info("Appointment confirmation email sent", {
          appointmentId: appointment.id,
          tenantId: this.tenantId,
        });
      }
    } catch (error) {
      log.error("Failed to send appointment notification email", {
        appointmentId,
        tenantId: this.tenantId,
        error: String(error),
      });
      // Don't throw - email failure shouldn't fail the appointment creation
    }
  }

  public async getAppointmentById(id: string): Promise<SelectAppointment> {
    const log = logger.setContext("AppointmentService");
    log.debug("Fetching appointment by ID", { appointmentId: id, tenantId: this.tenantId });
    const db = await this.getDb();

    const result = await db
      .select()
      .from(tenantSchema.appointment)
      .where(eq(tenantSchema.appointment.id, id))
      .limit(1);

    if (result.length === 0) {
      log.warn("Appointment not found", { appointmentId: id, tenantId: this.tenantId });
      throw new ValidationError("Appointment not found");
    }

    const row = result[0];
    return row;
  }

  public async confirmAppointment(
    id: string,
    clientEmail?: string,
    clientLanguage?: string,
  ): Promise<SelectAppointment> {
    const log = logger.setContext("AppointmentService");
    log.debug("Confirming appointment by ID", { appointmentId: id, tenantId: this.tenantId });
    const db = await this.getDb();

    const result = await db
      .update(tenantSchema.appointment)
      .set({ status: "CONFIRMED" })
      .where(and(eq(tenantSchema.appointment.id, id), eq(tenantSchema.appointment.status, "NEW")))
      .returning();

    if (result.length === 0) {
      log.warn("Appointment not found or in wrong state", {
        appointmentId: id,
        state: result[0] ? result[0].status : undefined,
        tenantId: this.tenantId,
      });
      throw new ValidationError("Appointment not found or in wrong state");
    }

    const row = result[0];

    // Send confirmation email to client if email is provided (async, don't wait)
    if (clientEmail) {
      this.sendAppointmentNotification(
        row.id,
        row.channelId,
        clientEmail,
        clientLanguage || "en",
        false,
      ).catch((error) => {
        log.error("Failed to send appointment confirmation email", {
          appointmentId: row.id,
          error: String(error),
        });
      });
    }

    const notificationService = await NotificationService.forTenant(this.tenantId);
    await notificationService.createNotification({
      channelId: row.channelId,
      type: "APPOINTMENT_CONFIRMED",
      metaData: {
        appointmentId: row.id,
      },
    });

    return row;
  }

  public async denyAppointment(
    id: string,
    clientEmail?: string,
    clientLanguage?: string,
  ): Promise<void> {
    const log = logger.setContext("AppointmentService");
    log.debug("Denying appointment by ID", { appointmentId: id, tenantId: this.tenantId });
    const db = await this.getDb();

    const result = await db
      .update(tenantSchema.appointment)
      .set({ status: "REJECTED" })
      .where(and(eq(tenantSchema.appointment.id, id), eq(tenantSchema.appointment.status, "NEW")))
      .returning();

    if (result.length === 0) {
      log.warn("Appointment not found or in wrong state", {
        appointmentId: id,
        state: result[0] ? result[0].status : undefined,
        tenantId: this.tenantId,
      });
      throw new ValidationError("Appointment not found or in wrong state");
    }

    const row = result[0];

    // Send rejection email to client if email is provided (async, don't wait)
    if (clientEmail) {
      await this.sendAppointmentNotification(
        row.id,
        row.channelId,
        clientEmail,
        clientLanguage || "en",
        false,
      ).catch((error) => {
        log.error("Failed to send appointment rejection email", {
          appointmentId: row.id,
          error: String(error),
        });
      });
    }

    db.delete(tenantSchema.appointment)
      .where(eq(tenantSchema.appointment.id, id))
      .then(() => {
        log.debug("Appointment deleted after rejection", {
          appointmentId: id,
          tenantId: this.tenantId,
        });
      })
      .catch((error) => {
        log.error("Failed to delete appointment after rejection", {
          appointmentId: id,
          error: String(error),
          tenantId: this.tenantId,
        });
      });
  }

  public async cancelAppointment(id: string): Promise<SelectAppointment> {
    const log = logger.setContext("AppointmentService");
    log.debug("Cancelling appointment by ID", { appointmentId: id, tenantId: this.tenantId });
    const db = await this.getDb();

    const result = await db
      .update(tenantSchema.appointment)
      .set({ status: "REJECTED" })
      .where(eq(tenantSchema.appointment.id, id))
      .returning();

    if (result.length === 0) {
      log.warn("Appointment not found or in wrong state", {
        appointmentId: id,
        state: result[0] ? result[0].status : undefined,
        tenantId: this.tenantId,
      });
      throw new ValidationError("Appointment not found or in wrong state");
    }

    const row = result[0];
    return row;
  }

  public async deleteAppointment(id: string): Promise<boolean> {
    const log = logger.setContext("AppointmentService");
    log.debug("Deleting appointment by ID", { appointmentId: id, tenantId: this.tenantId });
    const db = await this.getDb();

    const result = await db
      .delete(tenantSchema.appointment)
      .where(eq(tenantSchema.appointment.id, id))
      .returning();

    if (result.length === 0) {
      log.debug("Appointment not found for deletion", {
        appointmentId: id,
        tenantId: this.tenantId,
      });
      return false;
    }

    log.debug("Appointment deleted successfully", { appointmentId: id, tenantId: this.tenantId });
    return true;
  }

  /**
   * Delete appointment by staff member
   * This will:
   * 1. Remove the appointment from the database
   * 2. Send cancellation email to the client
   * 3. Create notifications for all staff members in the channel
   * @param appointmentId - The appointment ID
   * @param clientEmail - The client's email address
   * @param clientLanguage - The client's preferred language (optional, defaults to "de")
   * @returns Promise<void>
   */
  public async deleteAppointmentByStaff(
    appointmentId: string,
    clientEmail: string,
    clientLanguage: string = "de",
  ): Promise<void> {
    const log = logger.setContext("AppointmentService");
    log.debug("Deleting appointment by staff", {
      appointmentId,
      clientEmail,
      tenantId: this.tenantId,
    });

    const db = await this.getDb();

    // Get appointment details before deletion
    const appointmentResult = await db
      .select()
      .from(tenantSchema.appointment)
      .where(eq(tenantSchema.appointment.id, appointmentId))
      .limit(1);

    if (appointmentResult.length === 0) {
      log.warn("Appointment not found for deletion", {
        appointmentId,
        tenantId: this.tenantId,
      });
      throw new NotFoundError("Appointment not found");
    }

    const appointment = appointmentResult[0];
    const channelId = appointment.channelId;

    // Delete the appointment
    await db.delete(tenantSchema.appointment).where(eq(tenantSchema.appointment.id, appointmentId));

    log.debug("Appointment deleted from database", { appointmentId, tenantId: this.tenantId });

    // Get tenant and channel information for email and notifications
    const tenantService = await TenantAdminService.getTenantById(this.tenantId);
    const tenant = tenantService.tenantData;

    if (!tenant) {
      log.error("Tenant not found", { tenantId: this.tenantId });
      throw new InternalError("Tenant not found");
    }

    // Get channel title
    const channelTitle = await getChannelTitle(this.tenantId, channelId, clientLanguage);

    // Send cancellation email to client (async, don't wait)
    const clientData = {
      email: clientEmail,
      language: clientLanguage,
    };

    sendAppointmentCancelledEmail(clientData, tenant, appointment, channelTitle).catch((error) => {
      log.error("Failed to send appointment cancellation email", {
        appointmentId,
        clientEmail,
        error: String(error),
      });
    });

    // Create notifications for all staff members in the channel
    const notificationService = await NotificationService.forTenant(this.tenantId);

    // Create notifications (async, don't wait)
    notificationService
      .createNotification({
        channelId,
        type: "APPOINTMENT_CANCELLED",
        metaData: {
          appointmentId,
        },
      })
      .catch((error) => {
        log.error("Failed to create channel notifications", {
          appointmentId,
          channelId,
          error: String(error),
        });
      });

    log.info("Appointment deleted by staff successfully", {
      appointmentId,
      channelId,
      tenantId: this.tenantId,
    });
  }

  /**
   * Get all client tunnels for the tenant
   */
  public async getClientTunnels(): Promise<ClientTunnelResponse[]> {
    const log = logger.setContext("AppointmentService");
    log.debug("Fetching client tunnels", { tenantId: this.tenantId });
    const db = await this.getDb();

    const tunnels = await db
      .select({
        id: tenantSchema.clientAppointmentTunnel.id,
        emailHash: tenantSchema.clientAppointmentTunnel.emailHash,
        clientEncryptedTunnelKey: tenantSchema.clientAppointmentTunnel.clientEncryptedTunnelKey,
        clientPublicKey: tenantSchema.clientAppointmentTunnel.clientPublicKey,
        createdAt: tenantSchema.clientAppointmentTunnel.createdAt,
        updatedAt: tenantSchema.clientAppointmentTunnel.updatedAt,
      })
      .from(tenantSchema.clientAppointmentTunnel)
      .orderBy(tenantSchema.clientAppointmentTunnel.createdAt);

    log.debug("Client tunnels retrieved successfully", {
      tenantId: this.tenantId,
      tunnelCount: tunnels.length,
    });

    return tunnels.map((tunnel) => ({
      id: tunnel.id,
      emailHash: tunnel.emailHash,
      clientPublicKey: tunnel.clientPublicKey,
      clientEncryptedTunnelKey: tunnel.clientEncryptedTunnelKey,
      createdAt: tunnel.createdAt?.toISOString(),
      updatedAt: tunnel.updatedAt?.toISOString(),
    }));
  }

  /**
   * Add appointment to existing client tunnel
   */
  public async addAppointmentToTunnel(appointmentData: {
    emailHash: string;
    tunnelId: string;
    channelId: string;
    agentId: string;
    appointmentDate: string;
    duration: number;
    clientEmail: string;
    clientLanguage?: string;
    encryptedAppointment: {
      encryptedPayload: string;
      iv: string;
      authTag: string;
    };
  }): Promise<AppointmentResponse> {
    const log = logger.setContext("AppointmentService");

    log.info("Adding appointment to existing tunnel", {
      tenantId: this.tenantId,
      tunnelId: appointmentData.tunnelId,
      appointmentDate: appointmentData.appointmentDate,
      emailHashPrefix: appointmentData.emailHash.slice(0, 8),
    });

    const db = await this.getDb();

    // Check if tunnel exists and belongs to client
    const tunnelResult = await db
      .select({ id: tenantSchema.clientAppointmentTunnel.id })
      .from(tenantSchema.clientAppointmentTunnel)
      .where(eq(tenantSchema.clientAppointmentTunnel.emailHash, appointmentData.emailHash))
      .limit(1);

    if (tunnelResult.length === 0) {
      log.warn("Client tunnel not found", {
        tenantId: this.tenantId,
        tunnelId: appointmentData.tunnelId,
        emailHashPrefix: appointmentData.emailHash.slice(0, 8),
      });
      throw new NotFoundError("Tunnel not found or access denied");
    }

    // Get channel configuration to determine initial status
    const channelResult = await db
      .select({ requiresConfirmation: tenantSchema.channel.requiresConfirmation })
      .from(tenantSchema.channel)
      .where(
        and(
          eq(tenantSchema.channel.id, appointmentData.channelId),
          eq(tenantSchema.channel.isPublic, true),
        ),
      )
      .limit(1);

    if (channelResult.length === 0) {
      throw new NotFoundError("Active channel not found");
    }

    const initialStatus = channelResult[0].requiresConfirmation ? "NEW" : "CONFIRMED";
    const requiresConfirmation = channelResult[0].requiresConfirmation || false;

    // Create encrypted appointment
    const appointmentResult = await db
      .insert(tenantSchema.appointment)
      .values({
        tunnelId: appointmentData.tunnelId,
        channelId: appointmentData.channelId,
        agentId: appointmentData.agentId,
        appointmentDate: new Date(appointmentData.appointmentDate),
        duration: appointmentData.duration,
        encryptedPayload: appointmentData.encryptedAppointment.encryptedPayload,
        iv: appointmentData.encryptedAppointment.iv,
        authTag: appointmentData.encryptedAppointment.authTag,
        status: initialStatus,
      })
      .returning({
        id: tenantSchema.appointment.id,
        appointmentDate: tenantSchema.appointment.appointmentDate,
        status: tenantSchema.appointment.status,
      });

    if (appointmentResult.length === 0) {
      throw new InternalError("Failed to create appointment");
    }

    const result = appointmentResult[0];

    const response: AppointmentResponse = {
      id: result.id,
      appointmentDate: result.appointmentDate.toISOString(),
      status: result.status,
      requiresConfirmation,
    };

    log.info("Successfully added appointment to tunnel", {
      tenantId: this.tenantId,
      tunnelId: appointmentData.tunnelId,
      appointmentId: result.id,
    });

    return response;
  }

  /**
   * Create a new client tunnel with their first appointment
   */
  public async createNewClientWithAppointment(
    clientData: ClientTunnelData,
  ): Promise<AppointmentResponse> {
    const log = logger.setContext("AppointmentService");

    log.info("Creating new client appointment tunnel", {
      tenantId: this.tenantId,
      tunnelId: clientData.tunnelId,
      appointmentDate: clientData.appointmentDate,
      emailHashPrefix: clientData.emailHash.slice(0, 8),
    });

    // Check if there are any authorized users (ACCESS_GRANTED) in this tenant
    const authorizedUsers = await centralDb
      .select({ count: centralSchema.user.id })
      .from(centralSchema.user)
      .where(
        and(
          eq(centralSchema.user.tenantId, this.tenantId),
          eq(centralSchema.user.confirmationState, "ACCESS_GRANTED"),
        ),
      )
      .limit(1);

    if (authorizedUsers.length === 0) {
      log.warn("Client creation blocked: No authorized users in tenant", {
        tenantId: this.tenantId,
        tunnelId: clientData.tunnelId,
      });
      throw new ConflictError(
        "Cannot create client appointments: No authorized users found in tenant. At least one user must have ACCESS_GRANTED status.",
      );
    }

    const db = await this.getDb();

    // Check if client already exists
    const existingTunnel = await db
      .select({ id: tenantSchema.clientAppointmentTunnel.id })
      .from(tenantSchema.clientAppointmentTunnel)
      .where(eq(tenantSchema.clientAppointmentTunnel.emailHash, clientData.emailHash))
      .limit(1);

    if (existingTunnel.length > 0) {
      log.warn("Client creation failed: Email already registered", {
        tenantId: this.tenantId,
        emailHashPrefix: clientData.emailHash.slice(0, 8),
      });
      throw new ConflictError(
        "This email address is already registered. Please use the login option to book additional appointments.",
      );
    }

    // Transactional: Create tunnel and appointment
    const result = await db.transaction(async (tx) => {
      // 1. Create client appointment tunnel
      const tunnelResult = await tx
        .insert(tenantSchema.clientAppointmentTunnel)
        .values({
          id: clientData.tunnelId,
          emailHash: clientData.emailHash,
          clientPublicKey: clientData.clientPublicKey,
          privateKeyShare: clientData.privateKeyShare,
          clientEncryptedTunnelKey: clientData.clientEncryptedTunnelKey,
        })
        .returning({ id: tenantSchema.clientAppointmentTunnel.id });

      if (tunnelResult.length === 0) {
        throw new InternalError("Failed to create client appointment tunnel");
      }

      // 2. Store staff key shares for the tunnel
      if (clientData.staffKeyShares.length > 0) {
        await tx.insert(tenantSchema.clientTunnelStaffKeyShare).values(
          clientData.staffKeyShares.map((share) => ({
            tunnelId: clientData.tunnelId,
            userId: share.userId,
            encryptedTunnelKey: share.encryptedTunnelKey,
          })),
        );
      }

      // 3. Get channel configuration to determine initial status
      const channelResult = await tx
        .select({ requiresConfirmation: tenantSchema.channel.requiresConfirmation })
        .from(tenantSchema.channel)
        .where(
          and(
            eq(tenantSchema.channel.id, clientData.channelId),
            eq(tenantSchema.channel.archived, false),
          ),
        )
        .limit(1);

      if (channelResult.length === 0) {
        throw new NotFoundError("Channel not found");
      }

      const initialStatus = channelResult[0].requiresConfirmation ? "NEW" : "CONFIRMED";
      const requiresConfirmation = channelResult[0].requiresConfirmation || false;

      // 4. Create encrypted appointment
      const appointmentResult = await tx
        .insert(tenantSchema.appointment)
        .values({
          tunnelId: clientData.tunnelId,
          channelId: clientData.channelId,
          agentId: clientData.agentId,
          appointmentDate: new Date(clientData.appointmentDate),
          duration: clientData.duration,
          encryptedPayload: clientData.encryptedAppointment.encryptedPayload,
          iv: clientData.encryptedAppointment.iv,
          authTag: clientData.encryptedAppointment.authTag,
          status: initialStatus,
        })
        .returning({
          id: tenantSchema.appointment.id,
          appointmentDate: tenantSchema.appointment.appointmentDate,
          status: tenantSchema.appointment.status,
          tunnelId: tenantSchema.appointment.tunnelId,
          channelId: tenantSchema.appointment.channelId,
          agentId: tenantSchema.appointment.agentId,
          encryptedPayload: tenantSchema.appointment.encryptedPayload,
          iv: tenantSchema.appointment.iv,
          authTag: tenantSchema.appointment.authTag,
          expiryDate: tenantSchema.appointment.expiryDate,
          createdAt: tenantSchema.appointment.createdAt,
          updatedAt: tenantSchema.appointment.updatedAt,
        });

      if (initialStatus === "NEW") {
        const notificationService = await NotificationService.forTenant(this.tenantId);
        await notificationService.createNotification({
          channelId: clientData.channelId,
          type: "APPOINTMENT_REQUESTED",
          metaData: {
            appointmentId: appointmentResult[0].id,
          },
        });
      }

      if (appointmentResult.length === 0) {
        throw new InternalError("Failed to create appointment");
      }

      return { appointment: appointmentResult[0], requiresConfirmation };
    });

    const response: AppointmentResponse = {
      id: result.appointment.id,
      appointmentDate: result.appointment.appointmentDate.toISOString(),
      status: result.appointment.status,
      requiresConfirmation: result.requiresConfirmation,
    };

    log.info("Successfully created new client appointment tunnel", {
      tenantId: this.tenantId,
      tunnelId: clientData.tunnelId,
      appointmentId: result.appointment.id,
      staffSharesCount: clientData.staffKeyShares.length,
    });

    // Send email notification to client (async, don't wait)
    if (clientData.clientEmail) {
      this.sendAppointmentNotification(
        result.appointment.id,
        clientData.channelId,
        clientData.clientEmail,
        clientData.clientLanguage || "de",
        result.requiresConfirmation,
      ).catch((error) => {
        log.error("Failed to send appointment notification", {
          tunnelId: clientData.tunnelId,
          appointmentId: result.appointment.id,
          error: String(error),
        });
      });
    }

    return response;
  }

  /**
   * Return appointments for a specific agent from a given date
   * @param agentId
   * @param from
   * @returns
   */
  public async getAppointmentsForAgent(agentId: string, from: Date) {
    const log = logger.setContext("AppointmentService");
    log.debug("Fetching appointments for agent", {
      agentId,
      startDate: from.toISOString(),
      tenantId: this.tenantId,
    });

    const db = await this.getDb();

    const result = await db
      .select()
      .from(tenantSchema.appointment)
      .where(
        and(
          gte(tenantSchema.appointment.appointmentDate, from),
          eq(tenantSchema.appointment.agentId, agentId),
        ),
      )
      .orderBy(asc(tenantSchema.appointment.appointmentDate));

    return result;
  }

  /**
   * Return appointments for a specific channel from a given date
   * @param channelId
   * @param from
   * @returns
   */
  public async getAppointmentsForChannel(channelId: string, from: Date) {
    const log = logger.setContext("AppointmentService");
    log.debug("Fetching appointments for channel", {
      channelId,
      startDate: from.toISOString(),
      tenantId: this.tenantId,
    });

    const db = await this.getDb();

    const result = await db
      .select()
      .from(tenantSchema.appointment)
      .where(
        and(
          gte(tenantSchema.appointment.appointmentDate, from),
          eq(tenantSchema.appointment.channelId, channelId),
        ),
      )
      .orderBy(asc(tenantSchema.appointment.appointmentDate));

    return result;
  }

  public async getAppointmentsByTimeRange(
    startDate: Date,
    endDate: Date,
  ): Promise<SelectAppointment[]> {
    const log = logger.setContext("AppointmentService");
    log.debug("Fetching appointments by time range", {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      tenantId: this.tenantId,
    });
    const db = await this.getDb();

    const result = await db
      .select()
      .from(tenantSchema.appointment)
      .where(
        and(
          gte(tenantSchema.appointment.appointmentDate, startDate),
          lte(tenantSchema.appointment.appointmentDate, endDate),
        ),
      )
      .orderBy(asc(tenantSchema.appointment.appointmentDate));

    log.debug("Appointments retrieved successfully", {
      count: result.length,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      tenantId: this.tenantId,
    });

    return result;
  }

  /**
   * Get future appointments for a client by tunnel ID
   */
  public async getFutureAppointmentsByTunnelId(tunnelId: string): Promise<
    Array<{
      id: string;
      appointmentDate: string;
      status: string;
      channelId: string;
      encryptedPayload: string;
      iv: string;
      authTag: string;
    }>
  > {
    const log = logger.setContext("AppointmentService");
    log.debug("Fetching future appointments for client", {
      tenantId: this.tenantId,
      tunnelId,
    });

    const db = await this.getDb();

    // Get all future appointments for this tunnel
    const now = new Date();
    const appointments = await db
      .select({
        id: tenantSchema.appointment.id,
        appointmentDate: tenantSchema.appointment.appointmentDate,
        status: tenantSchema.appointment.status,
        channelId: tenantSchema.appointment.channelId,
        encryptedPayload: tenantSchema.appointment.encryptedPayload,
        iv: tenantSchema.appointment.iv,
        authTag: tenantSchema.appointment.authTag,
      })
      .from(tenantSchema.appointment)
      .where(
        and(
          eq(tenantSchema.appointment.tunnelId, tunnelId),
          gte(tenantSchema.appointment.appointmentDate, now),
        ),
      )
      .orderBy(asc(tenantSchema.appointment.appointmentDate));

    log.debug("Future appointments retrieved", {
      tenantId: this.tenantId,
      tunnelId,
      count: appointments.length,
    });

    return appointments.map((apt) => ({
      id: apt.id,
      appointmentDate: apt.appointmentDate.toISOString(),
      status: apt.status,
      channelId: apt.channelId,
      encryptedPayload: apt.encryptedPayload || "",
      iv: apt.iv || "",
      authTag: apt.authTag || "",
    }));
  }

  /**
   * Delete appointment by client with challenge-response authentication
   * This verifies that the client knows their PIN before allowing deletion
   */
  public async deleteAppointmentByClient(
    appointmentId: string,
    emailHash: string,
    challengeId: string,
    challengeResponse: string,
  ): Promise<void> {
    const log = logger.setContext("AppointmentService");
    log.info("Client deleting appointment with authentication", {
      tenantId: this.tenantId,
      appointmentId,
      emailHashPrefix: emailHash.slice(0, 8),
    });

    // 1. Verify challenge-response
    const storedChallenge = await challengeStore.consume(challengeId, this.tenantId);
    if (!storedChallenge) {
      log.warn("Challenge not found or expired", {
        tenantId: this.tenantId,
        challengeId,
      });
      throw new NotFoundError("Challenge not found or expired");
    }

    // Verify that the challenge belongs to this email
    if (storedChallenge.emailHash !== emailHash) {
      log.warn("Challenge does not belong to this client", {
        tenantId: this.tenantId,
        challengeId,
        emailHashPrefix: emailHash.slice(0, 8),
      });
      throw new ValidationError("Invalid authentication");
    }

    // Validate challenge response using constant-time comparison
    const expectedChallenge = storedChallenge.challenge;
    const challengeBuffer = Buffer.from(challengeResponse, "base64");
    const expectedBuffer = Buffer.from(expectedChallenge, "base64");

    if (
      challengeBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(challengeBuffer, expectedBuffer)
    ) {
      log.warn("Challenge response mismatch", {
        tenantId: this.tenantId,
        challengeId,
        emailHashPrefix: emailHash.slice(0, 8),
      });

      // Record failed attempt for throttling
      await challengeThrottleService.recordFailedAttempt(emailHash, "pin");

      throw new ValidationError("Invalid challenge response");
    }

    // Clear throttle on successful verification
    await challengeThrottleService.clearThrottle(emailHash, "pin");

    const db = await this.getDb();

    // 2. Get appointment and verify it belongs to this client's tunnel
    const appointmentResult = await db
      .select({
        id: tenantSchema.appointment.id,
        tunnelId: tenantSchema.appointment.tunnelId,
        appointmentDate: tenantSchema.appointment.appointmentDate,
        channelId: tenantSchema.appointment.channelId,
      })
      .from(tenantSchema.appointment)
      .where(eq(tenantSchema.appointment.id, appointmentId))
      .limit(1);

    if (appointmentResult.length === 0) {
      log.warn("Appointment not found", { appointmentId, tenantId: this.tenantId });
      throw new NotFoundError("Appointment not found");
    }

    const appointment = appointmentResult[0];

    // 3. Verify the appointment belongs to this client's tunnel
    const tunnelResult = await db
      .select({
        id: tenantSchema.clientAppointmentTunnel.id,
        emailHash: tenantSchema.clientAppointmentTunnel.emailHash,
      })
      .from(tenantSchema.clientAppointmentTunnel)
      .where(eq(tenantSchema.clientAppointmentTunnel.id, appointment.tunnelId))
      .limit(1);

    if (tunnelResult.length === 0) {
      log.warn("Client tunnel not found", {
        tunnelId: appointment.tunnelId,
        tenantId: this.tenantId,
      });
      throw new NotFoundError("Client not found");
    }

    const tunnel = tunnelResult[0];

    if (tunnel.emailHash !== emailHash) {
      log.warn("Appointment does not belong to this client", {
        appointmentId,
        tenantId: this.tenantId,
        emailHashPrefix: emailHash.slice(0, 8),
      });
      throw new ValidationError("Appointment does not belong to this client");
    }

    // 4. Delete the appointment
    await db.delete(tenantSchema.appointment).where(eq(tenantSchema.appointment.id, appointmentId));

    log.info("Appointment deleted successfully by client", {
      tenantId: this.tenantId,
      appointmentId,
      emailHashPrefix: emailHash.slice(0, 8),
    });

    const notificationService = await NotificationService.forTenant(this.tenantId);
    await notificationService.createNotification({
      channelId: appointment.channelId,
      type: "APPOINTMENT_CANCELLED",
      metaData: {
        appointmentId,
      },
    });

    log.info("Staff notification sent for client-initiated deletion", {
      tenantId: this.tenantId,
      appointmentId,
      channelId: appointment.channelId,
    });
  }

  /**
   * Get the tenant's database connection (cached)
   */
  private async getDb() {
    if (!this.#db) {
      this.#db = await getTenantDb(this.tenantId);
    }
    return this.#db;
  }
}
