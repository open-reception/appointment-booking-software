import { getTenantDb, centralDb } from "../db";
import * as tenantSchema from "../db/tenant-schema";
import { type SelectAppointment } from "../db/tenant-schema";
import { user } from "../db/central-schema";
import logger from "$lib/logger";
import { ValidationError, NotFoundError, InternalError, ConflictError } from "../utils/errors";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import type { AppointmentResponse } from "$lib/types/appointment";

export interface ClientTunnelData {
  tunnelId: string;
  channelId: string;
  agentId: string;
  appointmentDate: string;
  duration: number;
  emailHash: string;
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
   * Send appointment notification email
   */
  private async sendAppointmentNotification(
    email: string,
    appointment: SelectAppointment,
    status: "NEW" | "CONFIRMED",
  ): Promise<void> {
    // TODO: Implement email service integration
    const log = logger.setContext("AppointmentService");
    log.debug("Sending appointment notification", {
      email,
      appointmentId: appointment.id,
      status,
      tenantId: this.tenantId,
    });
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

  public async confirmAppointment(id: string): Promise<SelectAppointment> {
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
    return row;
  }

  public async cancelAppointment(id: string): Promise<SelectAppointment> {
    const log = logger.setContext("AppointmentService");
    log.debug("Confirming appointment by ID", { appointmentId: id, tenantId: this.tenantId });
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
      createdAt: tunnel.createdAt?.toISOString(),
      updatedAt: tunnel.updatedAt?.toISOString(),
    }));
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
      .select({ count: user.id })
      .from(user)
      .where(and(eq(user.tenantId, this.tenantId), eq(user.confirmationState, "ACCESS_GRANTED")))
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
        });

      if (appointmentResult.length === 0) {
        throw new InternalError("Failed to create appointment");
      }

      return appointmentResult[0];
    });

    const response: AppointmentResponse = {
      id: result.id,
      appointmentDate: result.appointmentDate.toISOString(),
      status: result.status,
    };

    log.info("Successfully created new client appointment tunnel", {
      tenantId: this.tenantId,
      tunnelId: clientData.tunnelId,
      appointmentId: result.id,
      staffSharesCount: clientData.staffKeyShares.length,
    });

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
   * Get the tenant's database connection (cached)
   */
  private async getDb() {
    if (!this.#db) {
      this.#db = await getTenantDb(this.tenantId);
    }
    return this.#db;
  }
}
