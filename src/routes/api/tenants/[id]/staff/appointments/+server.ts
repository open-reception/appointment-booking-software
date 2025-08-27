import { json, type RequestHandler } from "@sveltejs/kit";
import { getTenantDb, getTenant } from "$lib/server/db";
import * as tenantSchema from "$lib/server/db/tenant-schema";
import { ValidationError } from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { eq, and } from "drizzle-orm";
import { createHash } from "node:crypto";

/**
 * GET /api/tenants/[id]/staff/appointments
 * Get all appointments for staff member (encrypted data for client-side decryption)
 */
export const GET: RequestHandler = async ({ url, params, locals }) => {
	const log = logger.setContext("StaffAppointmentAPI");
	const tenantId = params.id as string;

	// TODO: Add proper staff authentication
	// For now, we'll use query parameter for staff ID (this should come from session)
	const staffId = url.searchParams.get("staffId");
	
	if (!staffId) {
		return json({
			success: false,
			error: "VALIDATION_ERROR",
			message: "staffId query parameter is required"
		}, { status: 400 });
	}

	log.debug("Getting appointments for staff", { tenantId, staffId });

	try {
		const tenant = await getTenant(tenantId);
		const db = await getTenantDb(tenantId);

		// Get all appointments with their key shares for this staff member
		const appointmentsWithKeys = await db
			.select({
				appointment: tenantSchema.appointment,
				channel: tenantSchema.channel,
				client: tenantSchema.client,
				keyShare: tenantSchema.appointmentKeyShare,
				staff: tenantSchema.staff
			})
			.from(tenantSchema.appointment)
			.innerJoin(
				tenantSchema.channel,
				eq(tenantSchema.appointment.channelId, tenantSchema.channel.id)
			)
			.innerJoin(
				tenantSchema.client,
				eq(tenantSchema.appointment.clientId, tenantSchema.client.id)
			)
			.innerJoin(
				tenantSchema.appointmentKeyShare,
				eq(tenantSchema.appointment.id, tenantSchema.appointmentKeyShare.appointmentId)
			)
			.innerJoin(
				tenantSchema.staff,
				eq(tenantSchema.appointmentKeyShare.staffId, tenantSchema.staff.id)
			)
			.where(eq(tenantSchema.appointmentKeyShare.staffId, staffId))
			.orderBy(tenantSchema.appointment.appointmentDate);

		const appointments = appointmentsWithKeys.map(({ appointment, channel, client, keyShare, staff }) => ({
			id: appointment.id,
			appointmentDate: appointment.appointmentDate,
			expiryDate: appointment.expiryDate,
			status: appointment.status,
			channel: {
				id: channel.id,
				names: channel.names,
				color: channel.color,
				languages: channel.languages
			},
			client: {
				id: client.id,
				hashKey: client.hashKey,
				publicKey: client.publicKey
				// Note: Don't expose client's privateKeyShare to staff
			},
			// Encrypted data for staff decryption
			encryptedData: appointment.encryptedData,
			staffKeyShare: keyShare.encryptedKey,
			staffInfo: {
				id: staff.id,
				publicKey: staff.publicKey
				// Staff will need their private key for decryption (from session/auth)
			}
		}));

		log.debug("Appointments retrieved for staff", {
			tenantId,
			staffId,
			appointmentCount: appointments.length
		});

		return json({
			success: true,
			data: appointments
		});

	} catch (error) {
		log.error("Internal error getting staff appointments", {
			tenantId,
			staffId,
			error: String(error)
		});

		return json({
			success: false,
			error: "INTERNAL_ERROR",
			message: "An unexpected error occurred"
		}, { status: 500 });
	}
};

/**
 * POST /api/tenants/[id]/staff/appointments/{appointmentId}
 * Get specific appointment details for staff (encrypted data)
 */
export const POST: RequestHandler = async ({ request, params }) => {
	const log = logger.setContext("StaffAppointmentAPI");
	const tenantId = params.id as string;

	try {
		const body = await request.json();
		const { staffId, appointmentId } = body;

		if (!staffId || !appointmentId) {
			return json({
				success: false,
				error: "VALIDATION_ERROR",
				message: "staffId and appointmentId are required in request body"
			}, { status: 400 });
		}

		log.debug("Getting appointment details for staff", { tenantId, staffId, appointmentId });

		const tenant = await getTenant(tenantId);
		const db = await getTenantDb(tenantId);

		// Get appointment with key share for this staff member
		const appointmentResult = await db
			.select({
				appointment: tenantSchema.appointment,
				channel: tenantSchema.channel,
				client: tenantSchema.client,
				keyShare: tenantSchema.appointmentKeyShare,
				staff: tenantSchema.staff
			})
			.from(tenantSchema.appointment)
			.innerJoin(
				tenantSchema.channel,
				eq(tenantSchema.appointment.channelId, tenantSchema.channel.id)
			)
			.innerJoin(
				tenantSchema.client,
				eq(tenantSchema.appointment.clientId, tenantSchema.client.id)
			)
			.innerJoin(
				tenantSchema.appointmentKeyShare,
				eq(tenantSchema.appointment.id, tenantSchema.appointmentKeyShare.appointmentId)
			)
			.innerJoin(
				tenantSchema.staff,
				eq(tenantSchema.appointmentKeyShare.staffId, tenantSchema.staff.id)
			)
			.where(
				and(
					eq(tenantSchema.appointment.id, appointmentId),
					eq(tenantSchema.appointmentKeyShare.staffId, staffId)
				)
			)
			.limit(1);

		if (appointmentResult.length === 0) {
			log.debug("Appointment not found or staff not authorized", {
				tenantId,
				staffId,
				appointmentId
			});
			return json({
				success: false,
				error: "NOT_FOUND",
				message: "Appointment not found or you don't have access to it"
			}, { status: 404 });
		}

		const { appointment, channel, client, keyShare, staff } = appointmentResult[0];

		const result = {
			id: appointment.id,
			appointmentDate: appointment.appointmentDate,
			expiryDate: appointment.expiryDate,
			status: appointment.status,
			channel: {
				id: channel.id,
				names: channel.names,
				color: channel.color,
				languages: channel.languages
			},
			client: {
				id: client.id,
				hashKey: client.hashKey,
				publicKey: client.publicKey
			},
			// Encrypted data for staff decryption
			encryptedData: appointment.encryptedData,
			staffKeyShare: keyShare.encryptedKey,
			staffInfo: {
				id: staff.id,
				publicKey: staff.publicKey
			}
		};

		log.debug("Appointment details retrieved for staff", {
			tenantId,
			staffId,
			appointmentId
		});

		return json({
			success: true,
			data: result
		});

	} catch (error) {
		log.error("Internal error getting appointment details for staff", {
			tenantId,
			error: String(error)
		});

		return json({
			success: false,
			error: "INTERNAL_ERROR",
			message: "An unexpected error occurred"
		}, { status: 500 });
	}
};

// Register OpenAPI documentation
registerOpenAPIRoute("GET", "/api/tenants/{tenantId}/staff/appointments", {
	tags: ["Staff", "Appointments"],
	summary: "Get all appointments for staff member",
	description: "Retrieves all appointments that a staff member has access to, with encrypted data for client-side decryption.",
	parameters: [
		{
			name: "tenantId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "The tenant ID"
		},
		{
			name: "staffId",
			in: "query",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "The staff member ID (should come from authentication session)"
		}
	],
	responses: {
		200: {
			description: "Appointments retrieved successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							success: { type: "boolean" },
							data: {
								type: "array",
								items: {
									type: "object",
									properties: {
										id: { type: "string", format: "uuid" },
										appointmentDate: { type: "string" },
										expiryDate: { type: "string" },
										status: { type: "string", enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"] },
										channel: {
											type: "object",
											properties: {
												id: { type: "string", format: "uuid" },
												names: { type: "array", items: { type: "string" } },
												color: { type: "string" },
												languages: { type: "array", items: { type: "string" } }
											}
										},
										client: {
											type: "object",
											properties: {
												id: { type: "string", format: "uuid" },
												hashKey: { type: "string" },
												publicKey: { type: "string" }
											}
										},
										encryptedData: { type: "string", description: "Encrypted appointment data" },
										staffKeyShare: { type: "string", description: "Encrypted symmetric key for staff decryption" },
										staffInfo: {
											type: "object",
											properties: {
												id: { type: "string", format: "uuid" },
												publicKey: { type: "string" }
											}
										}
									}
								}
							}
						}
					}
				}
			}
		},
		400: {
			description: "Validation error",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							success: { type: "boolean" },
							error: { type: "string" },
							message: { type: "string" }
						}
					}
				}
			}
		},
		500: {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							success: { type: "boolean" },
							error: { type: "string" },
							message: { type: "string" }
						}
					}
				}
			}
		}
	}
});

registerOpenAPIRoute("POST", "/api/tenants/{tenantId}/staff/appointments/{appointmentId}", {
	tags: ["Staff", "Appointments"],
	summary: "Get specific appointment details for staff",
	description: "Retrieves specific appointment details that a staff member has access to, with encrypted data for client-side decryption.",
	parameters: [
		{
			name: "tenantId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "The tenant ID"
		}
	],
	requestBody: {
		content: {
			"application/json": {
				schema: {
					type: "object",
					required: ["staffId", "appointmentId"],
					properties: {
						staffId: {
							type: "string",
							format: "uuid",
							description: "Staff member ID (should come from authentication session)"
						},
						appointmentId: {
							type: "string",
							format: "uuid",
							description: "Appointment ID to retrieve"
						}
					}
				}
			}
		}
	},
	responses: {
		200: {
			description: "Appointment details retrieved successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							success: { type: "boolean" },
							data: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid" },
									appointmentDate: { type: "string" },
									expiryDate: { type: "string" },
									status: { type: "string", enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"] },
									channel: {
										type: "object",
										properties: {
											id: { type: "string", format: "uuid" },
											names: { type: "array", items: { type: "string" } },
											color: { type: "string" },
											languages: { type: "array", items: { type: "string" } }
										}
									},
									client: {
										type: "object",
										properties: {
											id: { type: "string", format: "uuid" },
											hashKey: { type: "string" },
											publicKey: { type: "string" }
										}
									},
									encryptedData: { type: "string", description: "Encrypted appointment data" },
									staffKeyShare: { type: "string", description: "Encrypted symmetric key for staff decryption" },
									staffInfo: {
										type: "object",
										properties: {
											id: { type: "string", format: "uuid" },
											publicKey: { type: "string" }
										}
									}
								}
							}
						}
					}
				}
			}
		},
		400: {
			description: "Validation error"
		},
		404: {
			description: "Appointment not found or access denied"
		},
		500: {
			description: "Internal server error"
		}
	}
});