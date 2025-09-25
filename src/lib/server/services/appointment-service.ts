import { getTenantDb } from "../db";
import * as tenantSchema from "../db/tenant-schema";
import { type SelectAppointment } from "../db/tenant-schema";
import logger from "$lib/logger";
import { ValidationError } from "../utils/errors";
import { and, eq } from "drizzle-orm";

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
      log.warn("Appointment not found", { appointmentId: id, tenantId: this.tenantId });
      throw new ValidationError("Appointment not found");
    }

    return true;
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
