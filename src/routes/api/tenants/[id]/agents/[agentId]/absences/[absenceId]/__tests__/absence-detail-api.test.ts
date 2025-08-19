/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT, DELETE } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/server/services/agent-service", () => ({
	AgentService: {
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

import { AgentService } from "$lib/server/services/agent-service";
import { ValidationError, NotFoundError, ConflictError } from "$lib/server/utils/errors";

describe("Agent Absence Detail API Routes", () => {
	const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
	const mockAgentId = "agent-123";
	const mockAbsenceId = "absence-456";
	const mockAgentService = {
		getAbsenceById: vi.fn(),
		updateAbsence: vi.fn(),
		deleteAbsence: vi.fn()
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(AgentService.forTenant as any).mockResolvedValue(mockAgentService);
	});

	function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
		return {
			params: { id: mockTenantId, agentId: mockAgentId, absenceId: mockAbsenceId },
			locals: {
				user: {
					userId: "user123",
					role: "TENANT_ADMIN",
					tenantId: mockTenantId
				}
			},
			request: {
				json: vi.fn().mockResolvedValue({
					startDate: "2024-01-15T00:00:00.000Z",
					endDate: "2024-01-17T23:59:59.999Z",
					absenceType: "Krankheit",
					description: "Updated description",
					isFullDay: false
				})
			} as any,
			...overrides
		} as RequestEvent;
	}

	describe("GET /api/tenants/[id]/agents/[agentId]/absences/[absenceId]", () => {
		it("should return absence details for authenticated tenant admin", async () => {
			const mockAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockAbsence);

			const event = createMockRequestEvent();
			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.absence).toEqual(mockAbsence);
			expect(mockAgentService.getAbsenceById).toHaveBeenCalledWith(mockAbsenceId);
		});

		it("should allow staff to view absence details", async () => {
			const mockAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockAbsence);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						role: "STAFF",
						tenantId: mockTenantId
					} as any
				}
			});

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.absence).toEqual(mockAbsence);
		});

		it("should allow global admin to view absence details for any tenant", async () => {
			const mockAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockAbsence);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						role: "GLOBAL_ADMIN",
						tenantId: "different-tenant"
					} as any
				}
			});

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.absence).toEqual(mockAbsence);
		});

		it("should return 404 when absence not found", async () => {
			mockAgentService.getAbsenceById.mockResolvedValue(null);

			const event = createMockRequestEvent();
			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe("Absence not found");
		});

		it("should return 404 when absence belongs to different agent", async () => {
			const mockAbsence = {
				id: mockAbsenceId,
				agentId: "different-agent",
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockAbsence);

			const event = createMockRequestEvent();
			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe("Absence not found for this agent");
		});

		it("should reject unauthenticated requests", async () => {
			const event = createMockRequestEvent({
				locals: { user: null } as any
			});

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(401);
			expect(data.error).toBe("Authentication required");
		});

		it("should reject insufficient permissions", async () => {
			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						role: "STAFF",
						tenantId: "different-tenant"
					} as any
				}
			});

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.error).toBe("Insufficient permissions");
		});

		it("should handle service errors", async () => {
			mockAgentService.getAbsenceById.mockRejectedValue(new NotFoundError("Absence not found"));

			const event = createMockRequestEvent();
			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe("Absence not found");
		});
	});

	describe("PUT /api/tenants/[id]/agents/[agentId]/absences/[absenceId]", () => {
		it("should update absence for authenticated tenant admin", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Original description",
				isFullDay: true
			};

			const mockUpdatedAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Krankheit",
				description: "Updated description",
				isFullDay: false
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);
			mockAgentService.updateAbsence.mockResolvedValue(mockUpdatedAbsence);

			const event = createMockRequestEvent();
			const response = await PUT(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.message).toBe("Absence updated successfully");
			expect(data.absence).toEqual(mockUpdatedAbsence);
			expect(mockAgentService.updateAbsence).toHaveBeenCalledWith(mockAbsenceId, {
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Krankheit",
				description: "Updated description",
				isFullDay: false
			});
		});

		it("should allow staff to update absences", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Original description",
				isFullDay: true
			};

			const mockUpdatedAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Krankheit",
				description: "Updated description",
				isFullDay: false
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);
			mockAgentService.updateAbsence.mockResolvedValue(mockUpdatedAbsence);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						role: "STAFF",
						tenantId: mockTenantId
					} as any
				}
			});

			const response = await PUT(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.message).toBe("Absence updated successfully");
		});

		it("should allow global admin to update absences for any tenant", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Original description",
				isFullDay: true
			};

			const mockUpdatedAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Krankheit",
				description: "Updated description",
				isFullDay: false
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);
			mockAgentService.updateAbsence.mockResolvedValue(mockUpdatedAbsence);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						role: "GLOBAL_ADMIN",
						tenantId: "different-tenant"
					} as any
				}
			});

			const response = await PUT(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.message).toBe("Absence updated successfully");
		});

		it("should return 404 when absence not found before update", async () => {
			mockAgentService.getAbsenceById.mockResolvedValue(null);

			const event = createMockRequestEvent();
			const response = await PUT(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe("Absence not found");
			expect(mockAgentService.updateAbsence).not.toHaveBeenCalled();
		});

		it("should return 404 when absence belongs to different agent", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: "different-agent",
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Original description",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);

			const event = createMockRequestEvent();
			const response = await PUT(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe("Absence not found for this agent");
			expect(mockAgentService.updateAbsence).not.toHaveBeenCalled();
		});

		it("should handle validation errors", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Original description",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);
			mockAgentService.updateAbsence.mockRejectedValue(new ValidationError("Invalid date range"));

			const event = createMockRequestEvent();
			const response = await PUT(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe("Invalid date range");
		});

		it("should handle conflict errors for overlapping absences", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Original description",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);
			mockAgentService.updateAbsence.mockRejectedValue(
				new ConflictError("Absence overlaps with existing absence")
			);

			const event = createMockRequestEvent();
			const response = await PUT(event);
			const data = await response.json();

			expect(response.status).toBe(409);
			expect(data.error).toBe("Absence overlaps with existing absence");
		});
	});

	describe("DELETE /api/tenants/[id]/agents/[agentId]/absences/[absenceId]", () => {
		it("should delete absence for authenticated tenant admin", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);
			mockAgentService.deleteAbsence.mockResolvedValue(true);

			const event = createMockRequestEvent();
			const response = await DELETE(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.message).toBe("Absence deleted successfully");
			expect(mockAgentService.deleteAbsence).toHaveBeenCalledWith(mockAbsenceId);
		});

		it("should allow staff to delete absences", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);
			mockAgentService.deleteAbsence.mockResolvedValue(true);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						role: "STAFF",
						tenantId: mockTenantId
					} as any
				}
			});

			const response = await DELETE(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.message).toBe("Absence deleted successfully");
		});

		it("should allow global admin to delete absences for any tenant", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);
			mockAgentService.deleteAbsence.mockResolvedValue(true);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						role: "GLOBAL_ADMIN",
						tenantId: "different-tenant"
					} as any
				}
			});

			const response = await DELETE(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.message).toBe("Absence deleted successfully");
		});

		it("should return 404 when absence not found before delete", async () => {
			mockAgentService.getAbsenceById.mockResolvedValue(null);

			const event = createMockRequestEvent();
			const response = await DELETE(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe("Absence not found");
			expect(mockAgentService.deleteAbsence).not.toHaveBeenCalled();
		});

		it("should return 404 when absence belongs to different agent", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: "different-agent",
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);

			const event = createMockRequestEvent();
			const response = await DELETE(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe("Absence not found for this agent");
			expect(mockAgentService.deleteAbsence).not.toHaveBeenCalled();
		});

		it("should return 404 when delete operation fails", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);
			mockAgentService.deleteAbsence.mockResolvedValue(false);

			const event = createMockRequestEvent();
			const response = await DELETE(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe("Absence not found");
		});

		it("should handle service errors", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);
			mockAgentService.deleteAbsence.mockRejectedValue(new NotFoundError("Absence not found"));

			const event = createMockRequestEvent();
			const response = await DELETE(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe("Absence not found");
		});

		it("should handle internal server errors", async () => {
			const mockExistingAbsence = {
				id: mockAbsenceId,
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.getAbsenceById.mockResolvedValue(mockExistingAbsence);
			mockAgentService.deleteAbsence.mockRejectedValue(new Error("Database error"));

			const event = createMockRequestEvent();
			const response = await DELETE(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe("Internal server error");
		});
	});
});
