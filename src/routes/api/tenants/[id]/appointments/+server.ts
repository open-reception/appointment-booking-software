import { json, type RequestHandler } from "@sveltejs/kit";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import z from "zod/v4";
import { getTenant } from "$lib/server/db";

// Request validation schemas
const appointmentCreationSchema = z.object({
	email: z.string().email(),
	channelId: z.string().uuid(),
	agentId: z.string().uuid().optional(),
	appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	title: z.string().min(1).max(200),
	description: z.string().max(1000).optional(),
	language: z.enum(["de", "en"]).default("de"),
	publicKey: z.string().min(1),
	privateKeyShare: z.string().min(1)
});

// Register OpenAPI documentation
registerOpenAPIRoute("POST", "/api/tenants/{tenantId}/appointments", {
	tags: ["Appointments"],
	summary: "Create a new appointment",
	description:
		"Creates a new appointment for the specified tenant. If the client doesn't exist, it will be created automatically.",
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
					required: [
						"email",
						"channelId",
						"appointmentDate",
						"title",
						"publicKey",
						"privateKeyShare"
					],
					properties: {
						email: {
							type: "string",
							format: "email",
							description: "Client email address"
						},
						channelId: {
							type: "string",
							format: "uuid",
							description: "ID of the channel/resource to book"
						},
						agentId: {
							type: "string",
							format: "uuid",
							description: "Optional agent ID"
						},
						appointmentDate: {
							type: "string",
							description: "Appointment date in YYYY-MM-DD format"
						},
						title: {
							type: "string",
							minLength: 1,
							maxLength: 200,
							description: "Appointment title/subject"
						},
						description: {
							type: "string",
							maxLength: 1000,
							description: "Optional appointment description"
						},
						language: {
							type: "string",
							enum: ["de", "en"],
							default: "de",
							description: "Client's preferred language"
						},
						publicKey: {
							type: "string",
							description: "Client's public key for encryption"
						},
						privateKeyShare: {
							type: "string",
							description: "Server-side share of client's private key"
						}
					}
				}
			}
		}
	},
	responses: {
		201: {
			description: "Appointment created successfully",
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
									title: { type: "string" },
									description: { type: "string" },
									status: {
										type: "string",
										enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"]
									},
									channel: {
										type: "object",
										properties: {
											id: { type: "string", format: "uuid" },
											names: { type: "array", items: { type: "string" } },
											requiresConfirmation: { type: "boolean" }
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
		404: {
			description: "Resource not found",
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

registerOpenAPIRoute("GET", "/api/tenants/{tenantId}/appointments", {
	tags: ["Appointments"],
	summary: "Get available time slots",
	description: "Retrieves available time slots for a specific channel on a given date",
	parameters: [
		{
			name: "tenantId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "The tenant ID"
		},
		{
			name: "channelId",
			in: "query",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "The channel ID to check availability for"
		},
		{
			name: "date",
			in: "query",
			required: true,
			schema: { type: "string" },
			description: "Date to check availability for (YYYY-MM-DD format)"
		}
	],
	responses: {
		200: {
			description: "Available slots retrieved successfully",
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
										from: { type: "string", description: "Start time (HH:MM format)" },
										to: { type: "string", description: "End time (HH:MM format)" },
										duration: { type: "integer", description: "Duration in minutes" }
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

/**
 * POST /api/tenants/[id]/appointments
 * Create a new appointment for the tenant
 */
export const POST: RequestHandler = async ({ request, params }) => {
	const log = logger.setContext("AppointmentAPI");
	const tenantId = params.id as string;

	log.debug("Creating appointment", { tenantId });

	try {
		const body = await request.json();
		
		// Validate request body
		const validation = appointmentCreationSchema.safeParse(body);
		if (!validation.success) {
			log.debug("Validation error creating appointment", {
				tenantId,
				errors: validation.error.issues
			});
			return json({
				success: false,
				error: "VALIDATION_ERROR",
				message: "Invalid request data",
				details: validation.error.issues
			}, { status: 400 });
		}

		const tenant = await getTenant(tenantId);
		const appointmentService = await AppointmentService.forTenant(tenant);

		const appointment = await appointmentService.createAppointment(validation.data);

		log.debug("Appointment created successfully", {
			tenantId,
			appointmentId: appointment.id,
			status: appointment.status
		});

		return json(
			{
				success: true,
				data: {
					id: appointment.id,
					appointmentDate: appointment.appointmentDate,
					encryptedData: appointment.encryptedData,
					clientKeyShare: appointment.clientKeyShare,
					status: appointment.status,
					channel: {
						id: appointment.channel.id,
						names: appointment.channel.names,
						requiresConfirmation: appointment.channel.requiresConfirmation
					}
				}
			},
			{ status: 201 }
		);
	} catch (error) {
		if (error instanceof ValidationError) {
			log.debug("Validation error creating appointment", {
				tenantId,
				error: error.message
			});
			return json(
				{
					success: false,
					error: "VALIDATION_ERROR",
					message: error.message
				},
				{ status: 400 }
			);
		}

		if (error instanceof NotFoundError) {
			log.debug("Resource not found creating appointment", {
				tenantId,
				error: error.message
			});
			return json(
				{
					success: false,
					error: "NOT_FOUND",
					message: error.message
				},
				{ status: 404 }
			);
		}

		log.error("Internal error creating appointment", {
			tenantId,
			error: String(error)
		});

		return json(
			{
				success: false,
				error: "INTERNAL_ERROR",
				message: "An unexpected error occurred"
			},
			{ status: 500 }
		);
	}
};

/**
 * GET /api/tenants/[id]/appointments?channelId=xxx&date=YYYY-MM-DD
 * Get available time slots for a channel on a specific date
 */
export const GET: RequestHandler = async ({ url, params }) => {
	const log = logger.setContext("AppointmentAPI");
	const tenantId = params.id as string;
	const channelId = url.searchParams.get("channelId");
	const date = url.searchParams.get("date");

	if (!channelId || !date) {
		return json(
			{
				success: false,
				error: "VALIDATION_ERROR",
				message: "channelId and date query parameters are required"
			},
			{ status: 400 }
		);
	}

	log.debug("Getting available slots", { tenantId, channelId, date });

	try {
		const tenant = await getTenant(tenantId);
		const appointmentService = await AppointmentService.forTenant(tenant);
		const slots = await appointmentService.getAvailableSlots(channelId, date);

		log.debug("Available slots retrieved", {
			tenantId,
			channelId,
			date,
			slotCount: slots.length
		});

		return json({
			success: true,
			data: slots
		});
	} catch (error) {
		log.error("Internal error getting available slots", {
			tenantId,
			channelId,
			date,
			error: String(error)
		});

		return json(
			{
				success: false,
				error: "INTERNAL_ERROR",
				message: "An unexpected error occurred"
			},
			{ status: 500 }
		);
	}
};
