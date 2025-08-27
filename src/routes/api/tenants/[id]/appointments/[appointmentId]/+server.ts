import { json, type RequestHandler } from "@sveltejs/kit";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { ValidationError } from "$lib/server/utils/errors";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { getTenant } from "$lib/server/db";

// Register OpenAPI documentation
registerOpenAPIRoute("POST", "/api/tenants/{tenantId}/appointments/{appointmentId}", {
	tags: ["Appointments"],
	summary: "Get encrypted appointment details",
	description:
		"Retrieves encrypted appointment details for client-side decryption. Returns encrypted data and key shares - PIN verification and decryption happens in the frontend.",
	parameters: [
		{
			name: "tenantId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "The tenant ID"
		},
		{
			name: "appointmentId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "The appointment ID"
		}
	],
	requestBody: {
		content: {
			"application/json": {
				schema: {
					type: "object",
					required: ["email"],
					properties: {
						email: {
							type: "string",
							format: "email",
							description: "Client email address for verification"
						}
					}
				}
			}
		}
	},
	responses: {
		200: {
			description: "Encrypted appointment details retrieved successfully",
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
									status: {
										type: "string",
										enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"]
									},
									channel: {
										type: "object",
										properties: {
											id: { type: "string", format: "uuid" },
											names: { type: "array", items: { type: "string" } },
											color: { type: "string" },
											languages: { type: "array", items: { type: "string" } }
										}
									},
									encryptedData: { 
										type: "string", 
										description: "Encrypted appointment data for client-side decryption" 
									},
									clientKeyShare: { 
										type: "string", 
										description: "Encrypted symmetric key for client decryption" 
									},
									client: {
										type: "object",
										properties: {
											publicKey: { type: "string" },
											privateKeyShare: { type: "string" }
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
			description: "Appointment not found or access denied",
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

registerOpenAPIRoute("DELETE", "/api/tenants/{tenantId}/appointments/{appointmentId}", {
	tags: ["Appointments"],
	summary: "Cancel appointment",
	description:
		"Cancels an appointment. PIN verification should be done client-side before calling this endpoint. Only requires email for server-side verification.",
	parameters: [
		{
			name: "tenantId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "The tenant ID"
		},
		{
			name: "appointmentId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "The appointment ID"
		}
	],
	requestBody: {
		content: {
			"application/json": {
				schema: {
					type: "object",
					required: ["email"],
					properties: {
						email: {
							type: "string",
							format: "email",
							description: "Client email address for verification"
						}
					}
				}
			}
		}
	},
	responses: {
		200: {
			description: "Appointment cancelled successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							success: { type: "boolean" },
							message: { type: "string" }
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
			description: "Appointment not found or access denied",
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
 * POST /api/tenants/[id]/appointments/[appointmentId]
 * Get encrypted appointment details (client-side decryption)
 */
export const POST: RequestHandler = async ({ request, params }) => {
	const log = logger.setContext("AppointmentAPI");
	const tenantId = params.id as string;
	const appointmentId = params.appointmentId as string;

	log.debug("Getting appointment details", { tenantId, appointmentId });

	try {
		const body = await request.json();
		const { email } = body;

		if (!email) {
			return json(
				{
					success: false,
					error: "VALIDATION_ERROR",
					message: "email is required in request body"
				},
				{ status: 400 }
			);
		}

		const tenant = await getTenant(tenantId);
		const appointmentService = await AppointmentService.forTenant(tenant);
		
		// Get appointment without PIN - server never decrypts
		const appointment = await appointmentService.getAppointmentById(appointmentId, email);

		if (!appointment) {
			log.debug("Appointment not found or access denied", {
				tenantId,
				appointmentId
			});
			return json(
				{
					success: false,
					error: "NOT_FOUND",
					message: "Appointment not found or you don't have access to it"
				},
				{ status: 404 }
			);
		}

		log.debug("Appointment details retrieved (encrypted)", {
			tenantId,
			appointmentId,
			status: appointment.status
		});

		return json({
			success: true,
			data: {
				id: appointment.id,
				appointmentDate: appointment.appointmentDate,
				expiryDate: appointment.expiryDate,
				status: appointment.status,
				channel: {
					id: appointment.channel.id,
					names: appointment.channel.names,
					color: appointment.channel.color,
					languages: appointment.channel.languages
				},
				// Encrypted data for client-side decryption
				encryptedData: appointment.encryptedData,
				clientKeyShare: appointment.clientKeyShare,
				// Client crypto data for frontend decryption
				client: {
					publicKey: appointment.client.publicKey,
					privateKeyShare: appointment.client.privateKeyShare
				}
			}
		});
	} catch (error) {
		log.error("Internal error getting appointment details", {
			tenantId,
			appointmentId,
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
 * DELETE /api/tenants/[id]/appointments/[appointmentId]
 * Cancel an appointment (PIN verification happens client-side)
 */
export const DELETE: RequestHandler = async ({ request, params }) => {
	const log = logger.setContext("AppointmentAPI");
	const tenantId = params.id as string;
	const appointmentId = params.appointmentId as string;

	log.debug("Cancelling appointment", { tenantId, appointmentId });

	try {
		const body = await request.json();
		const { email } = body;

		if (!email) {
			return json(
				{
					success: false,
					error: "VALIDATION_ERROR",
					message: "email is required in request body"
				},
				{ status: 400 }
			);
		}

		// Note: PIN verification must happen client-side before calling this endpoint
		// Frontend should verify PIN can decrypt appointment data before cancelling

		const tenant = await getTenant(tenantId);
		const appointmentService = await AppointmentService.forTenant(tenant);
		const cancelled = await appointmentService.cancelAppointment({
			appointmentId,
			email
		});

		if (!cancelled) {
			log.debug("Appointment not found or access denied for cancellation", {
				tenantId,
				appointmentId
			});
			return json(
				{
					success: false,
					error: "NOT_FOUND",
					message: "Appointment not found or access denied"
				},
				{ status: 404 }
			);
		}

		log.debug("Appointment cancelled successfully", {
			tenantId,
			appointmentId
		});

		return json({
			success: true,
			message: "Appointment cancelled successfully"
		});
	} catch (error) {
		if (error instanceof ValidationError) {
			log.debug("Validation error cancelling appointment", {
				tenantId,
				appointmentId,
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

		log.error("Internal error cancelling appointment", {
			tenantId,
			appointmentId,
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
