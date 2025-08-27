import { getTenantDb } from "../db";
import * as tenantSchema from "../db/tenant-schema";
import { type SelectClient, type SelectAppointment, type SelectChannel, type SelectStaff } from "../db/tenant-schema";
import { type SelectTenant } from "../db/central-schema";
import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import logger from "$lib/logger";
import z from "zod/v4";
import { ValidationError, NotFoundError } from "../utils/errors";
import { sendAppointmentCreatedEmail, sendAppointmentReminderEmail } from "../email/email-service";
import { AppointmentEncryptionService, type AppointmentData } from "../crypto/appointment-encryption";

const appointmentCreationSchema = z.object({
	email: z.string().email(),
	channelId: z.string().uuid(),
	agentId: z.string().uuid().optional(),
	appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	title: z.string().min(1).max(200),
	description: z.string().max(1000).optional(),
	language: z.enum(["de", "en"]).default("de"),
	publicKey: z.string(),
	privateKeyShare: z.string()
});

const appointmentCancellationSchema = z.object({
	email: z.string().email(),
	appointmentId: z.string().uuid()
});

export type AppointmentCreationRequest = z.infer<typeof appointmentCreationSchema>;
export type AppointmentCancellationRequest = z.infer<typeof appointmentCancellationSchema>;

export interface AppointmentWithRelations extends SelectAppointment {
	client: SelectClient;
	channel: SelectChannel;
}

export class AppointmentService {
	#db: Awaited<ReturnType<typeof getTenantDb>> | null = null;

	private constructor(public readonly tenant: SelectTenant) {}

	/**
	 * Create an appointment service for a specific tenant
	 * @param tenant The tenant object
	 * @returns new AppointmentService instance
	 */
	static async forTenant(tenant: SelectTenant) {
		const log = logger.setContext("AppointmentService");
		log.debug("Creating appointment service for tenant", { tenantId: tenant.id });

		try {
			const service = new AppointmentService(tenant);
			service.#db = await getTenantDb(tenant.id);

			log.debug("Appointment service created successfully", { tenantId: tenant.id });
			return service;
		} catch (error) {
			log.error("Failed to create appointment service", { tenantId: tenant.id, error: String(error) });
			throw error;
		}
	}

	/**
	 * Create a new appointment with client registration if needed
	 * @param request Appointment creation request data
	 * @returns Created appointment with relations
	 */
	async createAppointment(request: AppointmentCreationRequest): Promise<AppointmentWithRelations> {
		const log = logger.setContext("AppointmentService");

		const validation = appointmentCreationSchema.safeParse(request);
		if (!validation.success) {
			throw new ValidationError("Invalid appointment creation request");
		}

		const emailHash = createHash("sha256").update(Buffer.from(request.email, "utf-8"));
		const emailHashKey = emailHash.digest("hex");

		log.debug("Creating new appointment", {
			tenantId: this.tenant.id,
			emailHash: emailHashKey.substring(0, 8),
			channelId: request.channelId,
			appointmentDate: request.appointmentDate
		});

		try {
			const db = await this.getDb();

			const result = await db.transaction(async (tx) => {
				// 1. Check if channel exists and is bookable
				const channelResult = await tx
					.select()
					.from(tenantSchema.channel)
					.where(eq(tenantSchema.channel.id, request.channelId))
					.limit(1);

				if (channelResult.length === 0) {
					throw new NotFoundError(`Channel with ID ${request.channelId} not found`);
				}

				const channel = channelResult[0];

				if (!channel.isPublic) {
					throw new ValidationError("Channel is not publicly bookable");
				}

				if (channel.pause) {
					throw new ValidationError("Channel is currently paused and not accepting appointments");
				}

				// 2. Get or create client
				let client: SelectClient;
				const existingClientResult = await tx
					.select()
					.from(tenantSchema.client)
					.where(eq(tenantSchema.client.hashKey, emailHashKey))
					.limit(1);

				if (existingClientResult.length > 0) {
					client = existingClientResult[0];
					log.debug("Using existing client", {
						tenantId: this.tenant.id,
						clientId: client.id,
						emailHash: emailHashKey.substring(0, 8)
					});
				} else {
					// Create new client
					const newClientResult = await tx
						.insert(tenantSchema.client)
						.values({
							hashKey: emailHashKey,
							publicKey: request.publicKey,
							privateKeyShare: request.privateKeyShare,
							email: request.email,
							language: request.language
						})
						.returning();

					client = newClientResult[0];
					log.debug("Created new client", {
						tenantId: this.tenant.id,
						clientId: client.id,
						emailHash: emailHashKey.substring(0, 8)
					});
				}

				// 3. Check for existing appointments on the same date/channel
				const existingAppointment = await tx
					.select()
					.from(tenantSchema.appointment)
					.where(
						and(
							eq(tenantSchema.appointment.clientId, client.id),
							eq(tenantSchema.appointment.channelId, request.channelId),
							eq(tenantSchema.appointment.appointmentDate, request.appointmentDate)
						)
					)
					.limit(1);

				if (existingAppointment.length > 0) {
					throw new ValidationError(
						"Client already has an appointment for this channel on this date"
					);
				}

				// 4. Calculate expiry date (30 days after appointment)
				const appointmentDate = new Date(request.appointmentDate);
				const expiryDate = new Date(appointmentDate);
				expiryDate.setDate(expiryDate.getDate() + 30);

				// 5. Get all staff members for key sharing
				const allStaff = await tx.select().from(tenantSchema.staff);

				// 6. Encrypt appointment data
				const appointmentData: AppointmentData = {
					title: request.title,
					description: request.description,
					clientEmail: request.email
				};

				const staffPublicKeys = allStaff.map(staff => ({
					staffId: staff.id,
					publicKey: staff.publicKey
				}));

				const encryptedResult = await AppointmentEncryptionService.encryptAppointmentData(
					appointmentData,
					client.publicKey,
					staffPublicKeys
				);

				// 7. Create appointment with encrypted data
				const appointmentResult = await tx
					.insert(tenantSchema.appointment)
					.values({
						clientId: client.id,
						channelId: request.channelId,
						appointmentDate: request.appointmentDate,
						expiryDate: expiryDate.toISOString().split("T")[0],
						encryptedData: encryptedResult.encryptedData,
						clientKeyShare: encryptedResult.clientKeyShare,
						status: channel.requiresConfirmation ? "NEW" : "CONFIRMED"
					})
					.returning();

				const appointment = appointmentResult[0];

				// 8. Create key shares for staff members
				for (const keyShare of encryptedResult.staffKeyShares) {
					await tx.insert(tenantSchema.appointmentKeyShare).values({
						appointmentId: appointment.id,
						staffId: keyShare.staffId,
						encryptedKey: keyShare.encryptedKey
					});
				}

				log.debug("Appointment created successfully", {
					tenantId: this.tenant.id,
					appointmentId: appointment.id,
					clientId: client.id,
					channelId: request.channelId,
					status: appointment.status
				});

				return {
					...appointment,
					client,
					channel
				};
			});

			// Send confirmation email
			try {
				await sendAppointmentCreatedEmail(
					result.client,
					this.tenant,
					result,
					`${process.env.PUBLIC_URL || 'https://localhost'}/appointments/${result.id}/cancel`
				);
				log.debug("Appointment confirmation email sent", {
					tenantId: this.tenant.id,
					appointmentId: result.id,
					clientEmail: result.client.email
				});
			} catch (emailError) {
				// Log email error but don't fail the appointment creation
				log.warn("Failed to send appointment confirmation email", {
					tenantId: this.tenant.id,
					appointmentId: result.id,
					error: String(emailError)
				});
			}

			return result;
		} catch (error) {
			if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
			log.error("Failed to create appointment", {
				tenantId: this.tenant.id,
				emailHash: emailHashKey.substring(0, 8),
				channelId: request.channelId,
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Cancel an appointment (requires email verification)
	 * @param request Appointment cancellation request
	 * @returns true if cancelled, false if not found
	 */
	async cancelAppointment(request: AppointmentCancellationRequest): Promise<boolean> {
		const log = logger.setContext("AppointmentService");

		const validation = appointmentCancellationSchema.safeParse(request);
		if (!validation.success) {
			throw new ValidationError("Invalid appointment cancellation request");
		}

		const emailHash = createHash("sha256").update(Buffer.from(request.email, "utf-8"));
		const emailHashKey = emailHash.digest("hex");

		log.debug("Cancelling appointment", {
			tenantId: this.tenant.id,
			appointmentId: request.appointmentId,
			emailHash: emailHashKey.substring(0, 8)
		});

		try {
			const db = await this.getDb();

			const result = await db.transaction(async (tx) => {
				// 1. Find client by email hash
				const clientResult = await tx
					.select()
					.from(tenantSchema.client)
					.where(eq(tenantSchema.client.hashKey, emailHashKey))
					.limit(1);

				if (clientResult.length === 0) {
					log.debug("Client not found for email", {
						tenantId: this.tenant.id,
						emailHash: emailHashKey.substring(0, 8)
					});
					return false;
				}

				const client = clientResult[0];

				// 2. Find appointment belonging to this client
				const appointmentResult = await tx
					.select()
					.from(tenantSchema.appointment)
					.where(
						and(
							eq(tenantSchema.appointment.id, request.appointmentId),
							eq(tenantSchema.appointment.clientId, client.id)
						)
					)
					.limit(1);

				if (appointmentResult.length === 0) {
					log.debug("Appointment not found or doesn't belong to client", {
						tenantId: this.tenant.id,
						appointmentId: request.appointmentId,
						clientId: client.id
					});
					return false;
				}

				const appointment = appointmentResult[0];

				// 3. Check if appointment can be cancelled
				if (appointment.status === "HELD" || appointment.status === "REJECTED") {
					throw new ValidationError(
						"Cannot cancel appointment that has already been held or rejected"
					);
				}

				// 4. Update appointment status to REJECTED
				await tx
					.update(tenantSchema.appointment)
					.set({ status: "REJECTED" })
					.where(eq(tenantSchema.appointment.id, request.appointmentId));

				log.debug("Appointment cancelled successfully", {
					tenantId: this.tenant.id,
					appointmentId: request.appointmentId,
					clientId: client.id
				});

				return true;
			});

			return result;
		} catch (error) {
			if (error instanceof ValidationError) throw error;
			log.error("Failed to cancel appointment", {
				tenantId: this.tenant.id,
				appointmentId: request.appointmentId,
				emailHash: emailHashKey.substring(0, 8),
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Get appointment by ID with client verification (returns encrypted data)
	 * @param appointmentId Appointment ID
	 * @param email Client email for verification
	 * @returns Appointment with encrypted data or null if not found/unauthorized
	 */
	async getAppointmentById(
		appointmentId: string,
		email: string
	): Promise<AppointmentWithRelations | null> {
		const log = logger.setContext("AppointmentService");
		const emailHash = createHash("sha256").update(Buffer.from(email, "utf-8"));
		const emailHashKey = emailHash.digest("hex");

		log.debug("Getting appointment by ID", {
			tenantId: this.tenant.id,
			appointmentId,
			emailHash: emailHashKey.substring(0, 8)
		});

		try {
			const db = await this.getDb();

			// Find client by email hash
			const clientResult = await db
				.select()
				.from(tenantSchema.client)
				.where(eq(tenantSchema.client.hashKey, emailHashKey))
				.limit(1);

			if (clientResult.length === 0) {
				log.debug("Client not found for email", {
					tenantId: this.tenant.id,
					emailHash: emailHashKey.substring(0, 8)
				});
				return null;
			}

			const client = clientResult[0];

			// Get appointment with channel data
			const appointmentResult = await db
				.select({
					appointment: tenantSchema.appointment,
					channel: tenantSchema.channel
				})
				.from(tenantSchema.appointment)
				.innerJoin(
					tenantSchema.channel,
					eq(tenantSchema.appointment.channelId, tenantSchema.channel.id)
				)
				.where(
					and(
						eq(tenantSchema.appointment.id, appointmentId),
						eq(tenantSchema.appointment.clientId, client.id)
					)
				)
				.limit(1);

			if (appointmentResult.length === 0) {
				log.debug("Appointment not found or doesn't belong to client", {
					tenantId: this.tenant.id,
					appointmentId,
					clientId: client.id
				});
				return null;
			}

			const { appointment, channel } = appointmentResult[0];

			// Return encrypted appointment data - client will decrypt
			const result = {
				...appointment,
				client,
				channel
			};

			log.debug("Appointment found (encrypted)", {
				tenantId: this.tenant.id,
				appointmentId,
				clientId: client.id,
				status: appointment.status
			});

			return result;
		} catch (error) {
			log.error("Failed to get appointment by ID", {
				tenantId: this.tenant.id,
				appointmentId,
				emailHash: emailHashKey.substring(0, 8),
				error: String(error)
			});
			throw error;
		}
	}

	/**
	 * Get available time slots for a channel on a specific date
	 * @param channelId Channel ID
	 * @param date Date in YYYY-MM-DD format
	 * @returns Array of available time slots
	 */
	async getAvailableSlots(
		channelId: string,
		date: string
	): Promise<{ from: string; to: string; duration: number }[]> {
		const log = logger.setContext("AppointmentService");

		log.debug("Getting available slots", {
			tenantId: this.tenant.id,
			channelId,
			date
		});

		try {
			const db = await this.getDb();

			// Get channel with slot templates
			const channelResult = await db
				.select({
					channel: tenantSchema.channel,
					slotTemplate: tenantSchema.slotTemplate
				})
				.from(tenantSchema.channel)
				.innerJoin(
					tenantSchema.channelSlotTemplate,
					eq(tenantSchema.channel.id, tenantSchema.channelSlotTemplate.channelId)
				)
				.innerJoin(
					tenantSchema.slotTemplate,
					eq(tenantSchema.channelSlotTemplate.slotTemplateId, tenantSchema.slotTemplate.id)
				)
				.where(eq(tenantSchema.channel.id, channelId));

			if (channelResult.length === 0) {
				log.debug("No slot templates found for channel", {
					tenantId: this.tenant.id,
					channelId
				});
				return [];
			}

			// Get day of week (0=Sunday, 1=Monday, etc.)
			const dateObj = new Date(date);
			const dayOfWeek = dateObj.getDay();
			const mondayBasedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday=0 format
			const dayBit = Math.pow(2, mondayBasedDay);

			// Filter slot templates for this day
			const availableTemplates = channelResult.filter(({ slotTemplate }) => {
				return slotTemplate.weekdays && (slotTemplate.weekdays & dayBit) > 0;
			});

			// Get existing appointments for this date to exclude booked slots
			const existingAppointments = await db
				.select()
				.from(tenantSchema.appointment)
				.where(
					and(
						eq(tenantSchema.appointment.channelId, channelId),
						eq(tenantSchema.appointment.appointmentDate, date),
						eq(tenantSchema.appointment.status, "CONFIRMED")
					)
				);

			// Generate available slots (simplified - would need more complex logic for real implementation)
			const slots = availableTemplates.map(({ slotTemplate }) => ({
				from: slotTemplate.from,
				to: slotTemplate.to,
				duration: slotTemplate.duration
			}));

			log.debug("Available slots found", {
				tenantId: this.tenant.id,
				channelId,
				date,
				slotCount: slots.length,
				bookedCount: existingAppointments.length
			});

			return slots;
		} catch (error) {
			log.error("Failed to get available slots", {
				tenantId: this.tenant.id,
				channelId,
				date,
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
			this.#db = await getTenantDb(this.tenant.id);
		}
		return this.#db;
	}
}
