import { json } from "@sveltejs/kit";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { NotFoundError } from "$lib/server/utils/errors";
import type { RequestHandler } from "@sveltejs/kit";
import { registerOpenAPIRoute } from "$lib/server/openapi";
import logger from "$lib/logger";
import { checkPermission } from "$lib/server/utils/permissions";

// Register OpenAPI documentation for PUT
registerOpenAPIRoute("/tenants/{id}/appointments/{appointmentId}/cancel", "PUT", {
	summary: "Cancel appointment",
	description:
		"Cancels an appointment by setting its status to REJECTED. Global admins, tenant admins, and staff can cancel appointments.",
	tags: ["Appointments"],
	parameters: [
		{
			name: "id",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "Tenant ID"
		},
		{
			name: "appointmentId",
			in: "path",
			required: true,
			schema: { type: "string", format: "uuid" },
			description: "Appointment ID"
		}
	],
	responses: {
		"200": {
			description: "Appointment cancelled successfully",
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							message: { type: "string", description: "Success message" },
							appointment: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid", description: "Appointment ID" },
									clientId: { type: "string", format: "uuid", description: "Client ID" },
									channelId: { type: "string", format: "uuid", description: "Channel ID" },
									appointmentDate: {
										type: "string",
										format: "date-time",
										description: "Appointment date"
									},
									expiryDate: { type: "string", format: "date", description: "Expiry date" },
									title: { type: "string", description: "Appointment title" },
									description: { type: "string", description: "Appointment description" },
									status: {
										type: "string",
										enum: ["NEW", "CONFIRMED", "HELD", "REJECTED", "NO_SHOW"]
									}
								},
								required: [
									"id",
									"clientId",
									"channelId",
									"appointmentDate",
									"expiryDate",
									"title",
									"status"
								]
							}
						},
						required: ["message", "appointment"]
					}
				}
			}
		},
		"401": {
			description: "Authentication required",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"403": {
			description: "Insufficient permissions",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"404": {
			description: "Tenant or appointment not found",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		},
		"500": {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: { $ref: "#/components/schemas/Error" }
				}
			}
		}
	}
});

export const PUT: RequestHandler = async ({ params, locals }) => {
	const log = logger.setContext("API");

	try {
		const tenantId = params.id;
		const appointmentId = params.appointmentId;

		// Check if user is authenticated
		if (!tenantId || !appointmentId) {
			return json({ error: "Tenant ID and appointment ID are required" }, { status: 400 });
		}

		const error = checkPermission(locals, tenantId);
		if (error) {
			return error;
		}

		log.debug("Cancelling appointment", {
			tenantId,
			appointmentId,
			requestedBy: locals.user?.userId
		});

		const appointmentService = await AppointmentService.forTenant(tenantId);
		const cancelledAppointment = await appointmentService.cancelAppointment(appointmentId);

		log.debug("Appointment cancelled successfully", {
			tenantId,
			appointmentId,
			requestedBy: locals.user?.userId
		});

		return json({
			message: "Appointment cancelled successfully",
			appointment: cancelledAppointment
		});
	} catch (error) {
		log.error("Error cancelling appointment:", JSON.stringify(error || "?"));

		if (error instanceof NotFoundError) {
			return json({ error: error.message }, { status: 404 });
		}

		return json({ error: "Internal server error" }, { status: 500 });
	}
};
