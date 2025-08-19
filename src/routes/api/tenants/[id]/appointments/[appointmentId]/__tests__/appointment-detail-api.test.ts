/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, DELETE } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/server/services/appointment-service", () => ({
	AppointmentService: {
		forTenant: vi.fn()
	}
}));

vi.mock("$lib/logger", () => ({
	default: {
		setContext: vi.fn(() => ({
			debug: vi.fn(),
			error: vi.fn()
		}))
	}
}));

import { AppointmentService } from "$lib/server/services/appointment-service";
import { NotFoundError } from "$lib/server/utils/errors";

describe("Appointment Detail API Routes", () => {
	const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
	const mockAppointmentId = "123e4567-e89b-12d3-a456-426614174003";
	const mockAppointmentService = {
		getAppointmentById: vi.fn(),
		deleteAppointment: vi.fn()
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(AppointmentService.forTenant as any).mockResolvedValue(mockAppointmentService);
	});

	function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
		return {
			params: { id: mockTenantId, appointmentId: mockAppointmentId },
			locals: {
				user: {
					userId: "user123",
					sessionId: "session123",
					role: "TENANT_ADMIN",
					tenantId: mockTenantId
				}
			},
			...overrides
		} as RequestEvent;
	}

	describe("GET /api/tenants/{id}/appointments/{appointmentId}", () => {
		it("should get appointment by ID successfully", async () => {
			const mockAppointment = {
				id: mockAppointmentId,
				clientId: "client123",
				channelId: "channel123",
				appointmentDate: "2024-12-01T10:00:00Z",
				expiryDate: "2024-12-31",
				title: "Test Appointment",
				status: "NEW",
				client: { id: "client123", email: "test@example.com" },
				channel: { id: "channel123", names: ["Room 1"] }
			};

			mockAppointmentService.getAppointmentById.mockResolvedValue(mockAppointment);

			const event = createMockRequestEvent();
			const response = await GET(event);
			const result = await response.json();

			expect(response.status).toBe(200);
			expect(result.appointment).toEqual(mockAppointment);
			expect(mockAppointmentService.getAppointmentById).toHaveBeenCalledWith(mockAppointmentId);
		});

		it("should return 404 if appointment not found", async () => {
			mockAppointmentService.getAppointmentById.mockResolvedValue(null);

			const event = createMockRequestEvent();
			const response = await GET(event);
			const result = await response.json();

			expect(response.status).toBe(404);
			expect(result.error).toBe("Appointment not found");
		});

		it("should return 401 if user is not authenticated", async () => {
			const event = createMockRequestEvent({
				locals: {}
			});

			const response = await GET(event);
			const result = await response.json();

			expect(response.status).toBe(401);
			expect(result.error).toBe("Authentication required");
		});

		it("should return 403 if user has insufficient permissions", async () => {
			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						sessionId: "session456",
						role: "CLIENT",
						tenantId: "different-tenant"
					} as any
				}
			});

			const response = await GET(event);
			const result = await response.json();

			expect(response.status).toBe(403);
			expect(result.error).toBe("Insufficient permissions");
		});

		it("should allow global admin to view appointments for any tenant", async () => {
			const mockAppointment = {
				id: mockAppointmentId,
				clientId: "client123",
				channelId: "channel123",
				appointmentDate: "2024-12-01T10:00:00Z",
				expiryDate: "2024-12-31",
				title: "Test Appointment",
				status: "NEW"
			};

			mockAppointmentService.getAppointmentById.mockResolvedValue(mockAppointment);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "admin123",
						sessionId: "session789",
						role: "GLOBAL_ADMIN",
						tenantId: "different-tenant"
					} as any
				}
			});

			const response = await GET(event);
			expect(response.status).toBe(200);
		});

		it("should allow staff to view appointments for their tenant", async () => {
			const mockAppointment = {
				id: mockAppointmentId,
				clientId: "client123",
				channelId: "channel123",
				appointmentDate: "2024-12-01T10:00:00Z",
				expiryDate: "2024-12-31",
				title: "Test Appointment",
				status: "NEW"
			};

			mockAppointmentService.getAppointmentById.mockResolvedValue(mockAppointment);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "staff123",
						sessionId: "session101",
						role: "STAFF",
						tenantId: mockTenantId
					} as any
				}
			});

			const response = await GET(event);
			expect(response.status).toBe(200);
		});
	});

	describe("DELETE /api/tenants/{id}/appointments/{appointmentId}", () => {
		it("should delete appointment successfully", async () => {
			mockAppointmentService.deleteAppointment.mockResolvedValue(true);

			const event = createMockRequestEvent();
			const response = await DELETE(event);
			const result = await response.json();

			expect(response.status).toBe(200);
			expect(result.message).toBe("Appointment deleted successfully");
			expect(mockAppointmentService.deleteAppointment).toHaveBeenCalledWith(mockAppointmentId);
		});

		it("should return 404 if appointment not found for deletion", async () => {
			mockAppointmentService.deleteAppointment.mockResolvedValue(false);

			const event = createMockRequestEvent();
			const response = await DELETE(event);
			const result = await response.json();

			expect(response.status).toBe(404);
			expect(result.error).toBe("Appointment not found");
		});

		it("should return 401 if user is not authenticated", async () => {
			const event = createMockRequestEvent({
				locals: {}
			});

			const response = await DELETE(event);
			const result = await response.json();

			expect(response.status).toBe(401);
			expect(result.error).toBe("Authentication required");
		});

		it("should return 403 if user has insufficient permissions (staff cannot delete)", async () => {
			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "staff123",
						sessionId: "session102",
						role: "STAFF",
						tenantId: mockTenantId
					} as any
				}
			});

			const response = await DELETE(event);
			const result = await response.json();

			expect(response.status).toBe(403);
			expect(result.error).toBe("Insufficient permissions");
		});

		it("should allow global admin to delete appointments for any tenant", async () => {
			mockAppointmentService.deleteAppointment.mockResolvedValue(true);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "admin123",
						sessionId: "session103",
						role: "GLOBAL_ADMIN",
						tenantId: "different-tenant"
					} as any
				}
			});

			const response = await DELETE(event);
			expect(response.status).toBe(200);
		});

		it("should allow tenant admin to delete appointments for their tenant", async () => {
			mockAppointmentService.deleteAppointment.mockResolvedValue(true);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "admin123",
						sessionId: "session104",
						role: "TENANT_ADMIN",
						tenantId: mockTenantId
					} as any
				}
			});

			const response = await DELETE(event);
			expect(response.status).toBe(200);
		});

		it("should return 400 if tenant ID or appointment ID is missing", async () => {
			const event = createMockRequestEvent({
				params: { id: mockTenantId }
			});

			const response = await DELETE(event);
			const result = await response.json();

			expect(response.status).toBe(400);
			expect(result.error).toBe("Tenant ID and appointment ID are required");
		});

		it("should return 404 for not found errors", async () => {
			mockAppointmentService.deleteAppointment.mockRejectedValue(
				new NotFoundError("Tenant not found")
			);

			const event = createMockRequestEvent();
			const response = await DELETE(event);
			const result = await response.json();

			expect(response.status).toBe(404);
			expect(result.error).toBe("Tenant not found");
		});
	});
});
