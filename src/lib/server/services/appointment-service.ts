import { getTenantDb } from "../db";
import * as tenantSchema from "../db/tenant-schema";
import { type SelectAppointment, type SelectClient, type SelectChannel } from "../db/tenant-schema";

import { eq, and, between, or } from "drizzle-orm";
import logger from "$lib/logger";
import z from "zod/v4";
import { ValidationError, NotFoundError, ConflictError } from "../utils/errors";

const appointmentCreationSchema = z.object({
	clientId: z.string().uuid(),
	channelId: z.string().uuid(),
	appointmentDate: z.string().datetime(),
	expiryDate: z.string().date(),
	title: z.string().min(1).max(200),
	description: z.string().optional(),
	status: z.enum(["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"]).default("NEW")
});

const appointmentUpdateSchema = z.object({
	appointmentDate: z.string().datetime().optional(),
	expiryDate: z.string().date().optional(),
	title: z.string().min(1).max(200).optional(),
	description: z.string().optional(),
	status: z.enum(["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"]).optional()
});

const appointmentQuerySchema = z.object({
	startDate: z.string().datetime(),
	endDate: z.string().datetime(),
	channelId: z.string().uuid().optional(),
	clientId: z.string().uuid().optional(),
	status: z.enum(["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"]).optional()
});

export type AppointmentCreationRequest = z.infer<typeof appointmentCreationSchema>;
export type AppointmentUpdateRequest = z.infer<typeof appointmentUpdateSchema>;
export type AppointmentQueryRequest = z.infer<typeof appointmentQuerySchema>;

export interface AppointmentWithDetails extends SelectAppointment {
	client?: SelectClient;
	channel?: SelectChannel;
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
	 * Create a new appointment
	 * @param request Appointment creation request data
	 * @returns Created appointment
	 */
	async createAppointment(request: AppointmentCreationRequest): Promise<SelectAppointment> {
		const log = logger.setContext("AppointmentService");

		const validation = appointmentCreationSchema.safeParse(request);
		if (!validation.success) {
			throw new ValidationError("Invalid appointment creation request");
		}

		log.debug("Creating new appointment", {
			tenantId: this.tenantId,
			clientId: request.clientId,
			channelId: request.channelId,
			appointmentDate: request.appointmentDate
		});

		try {
			const db = await this.getDb();

			// Check if client exists
			const client = await db
				.select()
				.from(tenantSchema.client)
				.where(eq(tenantSchema.client.id, request.clientId))
				.limit(1);

			if (client.length === 0) {
				throw new NotFoundError(`Client with ID ${request.clientId} not found`);
			}

			// Check if channel exists and is not paused
			const channel = await db
				.select()
				.from(tenantSchema.channel)
				.where(eq(tenantSchema.channel.id, request.channelId))
				.limit(1);

			if (channel.length === 0) {
				throw new NotFoundError(`Channel with ID ${request.channelId} not found`);
			}

			if (channel[0].pause) {
				throw new ConflictError("Channel is currently paused and not accepting appointments");
			}

			// Check for conflicting appointments at the same time slot
			const conflictingAppointments = await db
				.select()
				.from(tenantSchema.appointment)
				.where(
					and(
						eq(tenantSchema.appointment.channelId, request.channelId),
						eq(tenantSchema.appointment.appointmentDate, request.appointmentDate),
						or(
							eq(tenantSchema.appointment.status, "NEW"),
							eq(tenantSchema.appointment.status, "CONFIRMED"),
							eq(tenantSchema.appointment.status, "HELD")
						)
					)
				);

			if (conflictingAppointments.length > 0) {
				throw new ConflictError("Time slot is already booked");
			}

			// Create the appointment
			const result = await db
				.insert(tenantSchema.appointment)
				.values({
					clientId: request.clientId,
					channelId: request.channelId,
					appointmentDate: request.appointmentDate,
					expiryDate: request.expiryDate,
					title: request.title,
					description: request.description,
					status: request.status
				})
				.returning();

			log.debug("Appointment created successfully", {
				tenantId: this.tenantId,
				appointmentId: result[0].id,
				clientId: request.clientId,
				channelId: request.channelId
			});

			return result[0];
		} catch (error) {
			if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
			log.error("Failed to create appointment", {
				tenantId: this.tenantId,
				clientId: request.clientId,
				channelId: request.channelId,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Get an appointment by ID
	 * @param appointmentId Appointment ID
	 * @returns Appointment with details or null if not found
	 */
	async getAppointmentById(appointmentId: string): Promise<AppointmentWithDetails | null> {
		const log = logger.setContext("AppointmentService");
		log.debug("Getting appointment by ID", { tenantId: this.tenantId, appointmentId });

		try {
			const db = await this.getDb();
			const result = await db
				.select({
					appointment: tenantSchema.appointment,
					client: tenantSchema.client,
					channel: tenantSchema.channel
				})
				.from(tenantSchema.appointment)
				.leftJoin(tenantSchema.client, eq(tenantSchema.appointment.clientId, tenantSchema.client.id))
				.leftJoin(tenantSchema.channel, eq(tenantSchema.appointment.channelId, tenantSchema.channel.id))
				.where(eq(tenantSchema.appointment.id, appointmentId))
				.limit(1);

			if (result.length === 0) {
				log.debug("Appointment not found", { tenantId: this.tenantId, appointmentId });
				return null;
			}

			const row = result[0];
			log.debug("Appointment found", { tenantId: this.tenantId, appointmentId });

			return {
				...row.appointment,
				client: row.client || undefined,
				channel: row.channel || undefined
			};
		} catch (error) {
			log.error("Failed to get appointment by ID", {
				tenantId: this.tenantId,
				appointmentId,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Query appointments with filters
	 * @param query Query parameters
	 * @returns Array of appointments matching criteria
	 */
	async queryAppointments(query: AppointmentQueryRequest): Promise<AppointmentWithDetails[]> {
		const log = logger.setContext("AppointmentService");

		const validation = appointmentQuerySchema.safeParse(query);
		if (!validation.success) {
			throw new ValidationError("Invalid appointment query request");
		}

		log.debug("Querying appointments", {
			tenantId: this.tenantId,
			startDate: query.startDate,
			endDate: query.endDate,
			channelId: query.channelId,
			clientId: query.clientId,
			status: query.status
		});

		try {
			const db = await this.getDb();

			// Build where conditions dynamically
			const conditions = [
				between(tenantSchema.appointment.appointmentDate, query.startDate, query.endDate)
			];

			if (query.channelId) {
				conditions.push(eq(tenantSchema.appointment.channelId, query.channelId));
			}

			if (query.clientId) {
				conditions.push(eq(tenantSchema.appointment.clientId, query.clientId));
			}

			if (query.status) {
				conditions.push(eq(tenantSchema.appointment.status, query.status));
			}

			const result = await db
				.select({
					appointment: tenantSchema.appointment,
					client: tenantSchema.client,
					channel: tenantSchema.channel
				})
				.from(tenantSchema.appointment)
				.leftJoin(tenantSchema.client, eq(tenantSchema.appointment.clientId, tenantSchema.client.id))
				.leftJoin(tenantSchema.channel, eq(tenantSchema.appointment.channelId, tenantSchema.channel.id))
				.where(and(...conditions))
				.orderBy(tenantSchema.appointment.appointmentDate);

			log.debug("Retrieved appointments", {
				tenantId: this.tenantId,
				count: result.length
			});

			return result.map(row => ({
				...row.appointment,
				client: row.client || undefined,
				channel: row.channel || undefined
			}));
		} catch (error) {
			log.error("Failed to query appointments", {
				tenantId: this.tenantId,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Update an existing appointment
	 * @param appointmentId Appointment ID
	 * @param updateData Appointment update data
	 * @returns Updated appointment
	 */
	async updateAppointment(appointmentId: string, updateData: AppointmentUpdateRequest): Promise<SelectAppointment> {
		const log = logger.setContext("AppointmentService");

		const validation = appointmentUpdateSchema.safeParse(updateData);
		if (!validation.success) {
			throw new ValidationError("Invalid appointment update request");
		}

		log.debug("Updating appointment", {
			tenantId: this.tenantId,
			appointmentId,
			updateFields: Object.keys(updateData)
		});

		try {
			const db = await this.getDb();

			// If updating appointment date, check for conflicts
			if (updateData.appointmentDate) {
				const existingAppointment = await db
					.select()
					.from(tenantSchema.appointment)
					.where(eq(tenantSchema.appointment.id, appointmentId))
					.limit(1);

				if (existingAppointment.length === 0) {
					throw new NotFoundError(`Appointment with ID ${appointmentId} not found`);
				}

				// Check for conflicting appointments at the new time slot
				const conflictingAppointments = await db
					.select()
					.from(tenantSchema.appointment)
					.where(
						and(
							eq(tenantSchema.appointment.channelId, existingAppointment[0].channelId),
							eq(tenantSchema.appointment.appointmentDate, updateData.appointmentDate),
							eq(tenantSchema.appointment.id, appointmentId), // Exclude current appointment
							or(
								eq(tenantSchema.appointment.status, "NEW"),
								eq(tenantSchema.appointment.status, "CONFIRMED"),
								eq(tenantSchema.appointment.status, "HELD")
							)
						)
					);

				if (conflictingAppointments.length > 0) {
					throw new ConflictError("New time slot is already booked");
				}
			}

			const result = await db
				.update(tenantSchema.appointment)
				.set(updateData)
				.where(eq(tenantSchema.appointment.id, appointmentId))
				.returning();

			if (result.length === 0) {
				log.warn("Appointment update failed: Appointment not found", {
					tenantId: this.tenantId,
					appointmentId
				});
				throw new NotFoundError(`Appointment with ID ${appointmentId} not found`);
			}

			log.debug("Appointment updated successfully", {
				tenantId: this.tenantId,
				appointmentId,
				updateFields: Object.keys(updateData)
			});

			return result[0];
		} catch (error) {
			if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
			log.error("Failed to update appointment", {
				tenantId: this.tenantId,
				appointmentId,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Cancel an appointment (set status to REJECTED)
	 * @param appointmentId Appointment ID
	 * @returns Updated appointment
	 */
	async cancelAppointment(appointmentId: string): Promise<SelectAppointment> {
		const log = logger.setContext("AppointmentService");
		log.debug("Cancelling appointment", { tenantId: this.tenantId, appointmentId });

		return this.updateAppointment(appointmentId, { status: "REJECTED" });
	}

	/**
	 * Confirm an appointment (set status to CONFIRMED)
	 * @param appointmentId Appointment ID
	 * @returns Updated appointment
	 */
	async confirmAppointment(appointmentId: string): Promise<SelectAppointment> {
		const log = logger.setContext("AppointmentService");
		log.debug("Confirming appointment", { tenantId: this.tenantId, appointmentId });

		return this.updateAppointment(appointmentId, { status: "CONFIRMED" });
	}

	/**
	 * Mark appointment as completed (set status to HELD)
	 * @param appointmentId Appointment ID
	 * @returns Updated appointment
	 */
	async completeAppointment(appointmentId: string): Promise<SelectAppointment> {
		const log = logger.setContext("AppointmentService");
		log.debug("Completing appointment", { tenantId: this.tenantId, appointmentId });

		return this.updateAppointment(appointmentId, { status: "HELD" });
	}

	/**
	 * Mark appointment as no-show (set status to NO_SHOW)
	 * @param appointmentId Appointment ID
	 * @returns Updated appointment
	 */
	async markNoShow(appointmentId: string): Promise<SelectAppointment> {
		const log = logger.setContext("AppointmentService");
		log.debug("Marking appointment as no-show", { tenantId: this.tenantId, appointmentId });

		return this.updateAppointment(appointmentId, { status: "NO_SHOW" });
	}

	/**
	 * Delete an appointment
	 * @param appointmentId Appointment ID
	 * @returns true if deleted, false if not found
	 */
	async deleteAppointment(appointmentId: string): Promise<boolean> {
		const log = logger.setContext("AppointmentService");
		log.debug("Deleting appointment", { tenantId: this.tenantId, appointmentId });

		try {
			const db = await this.getDb();
			const result = await db
				.delete(tenantSchema.appointment)
				.where(eq(tenantSchema.appointment.id, appointmentId))
				.returning();

			if (result.length === 0) {
				log.debug("Appointment deletion failed: Appointment not found", {
					tenantId: this.tenantId,
					appointmentId
				});
				return false;
			}

			log.debug("Appointment deleted successfully", {
				tenantId: this.tenantId,
				appointmentId
			});

			return true;
		} catch (error) {
			log.error("Failed to delete appointment", {
				tenantId: this.tenantId,
				appointmentId,
				error: String(error)
			});
			throw error;
		}
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