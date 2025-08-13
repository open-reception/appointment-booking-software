/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../+server";
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

describe("Agent Absence API Routes", () => {
	const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
	const mockAgentId = "agent-123";
	const mockAgentService = {
		createAbsence: vi.fn(),
		getAgentAbsences: vi.fn()
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(AgentService.forTenant as any).mockResolvedValue(mockAgentService);
	});

	function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
		return {
			params: { id: mockTenantId, agentId: mockAgentId },
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
					absenceType: "Urlaub",
					description: "Jahresurlaub",
					isFullDay: true
				})
			} as any,
			url: new URL("http://localhost:3000/api/tenants/123/agents/agent-123/absences"),
			...overrides
		} as RequestEvent;
	}

	describe("POST /api/tenants/[id]/agents/[agentId]/absences", () => {
		it("should create absence for authenticated tenant admin", async () => {
			const mockAbsence = {
				id: "absence1",
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.createAbsence.mockResolvedValue(mockAbsence);

			const event = createMockRequestEvent();
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(201);
			expect(data.message).toBe("Absence created successfully");
			expect(data.absence).toEqual(mockAbsence);
			expect(mockAgentService.createAbsence).toHaveBeenCalledWith({
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true,
				agentId: mockAgentId
			});
		});

		it("should allow staff to create absences", async () => {
			const mockAbsence = {
				id: "absence1",
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Krankheit",
				description: null,
				isFullDay: true
			};

			mockAgentService.createAbsence.mockResolvedValue(mockAbsence);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						role: "STAFF",
						tenantId: mockTenantId
					}
				},
				request: {
					json: vi.fn().mockResolvedValue({
						startDate: "2024-01-15T00:00:00.000Z",
						endDate: "2024-01-17T23:59:59.999Z",
						absenceType: "Krankheit",
						isFullDay: true
					})
				} as any
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(201);
			expect(data.message).toBe("Absence created successfully");
			expect(data.absence).toEqual(mockAbsence);
		});

		it("should allow global admin to create absences for any tenant", async () => {
			const mockAbsence = {
				id: "absence1",
				agentId: mockAgentId,
				startDate: "2024-01-15T00:00:00.000Z",
				endDate: "2024-01-17T23:59:59.999Z",
				absenceType: "Urlaub",
				description: "Jahresurlaub",
				isFullDay: true
			};

			mockAgentService.createAbsence.mockResolvedValue(mockAbsence);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						role: "GLOBAL_ADMIN",
						tenantId: "different-tenant"
					}
				}
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(201);
			expect(data.message).toBe("Absence created successfully");
		});

		it("should reject unauthenticated requests", async () => {
			const event = createMockRequestEvent({
				locals: { user: null }
			});

			const response = await POST(event);
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
					}
				}
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.error).toBe("Insufficient permissions");
		});

		it("should handle validation errors", async () => {
			mockAgentService.createAbsence.mockRejectedValue(new ValidationError("Invalid date range"));

			const event = createMockRequestEvent();
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe("Invalid date range");
		});

		it("should handle not found errors", async () => {
			mockAgentService.createAbsence.mockRejectedValue(new NotFoundError("Agent not found"));

			const event = createMockRequestEvent();
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe("Agent not found");
		});

		it("should handle conflict errors for overlapping absences", async () => {
			mockAgentService.createAbsence.mockRejectedValue(
				new ConflictError("Absence overlaps with existing absence")
			);

			const event = createMockRequestEvent();
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(409);
			expect(data.error).toBe("Absence overlaps with existing absence");
		});

		it("should handle internal server errors", async () => {
			mockAgentService.createAbsence.mockRejectedValue(new Error("Database error"));

			const event = createMockRequestEvent();
			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe("Internal server error");
		});

		it("should handle missing parameters", async () => {
			const event = createMockRequestEvent({
				params: { id: mockTenantId, agentId: undefined }
			});

			const response = await POST(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe("Missing tenant or agent ID");
		});
	});

	describe("GET /api/tenants/[id]/agents/[agentId]/absences", () => {
		it("should return agent absences for authenticated tenant admin", async () => {
			const mockAbsences = [
				{
					id: "absence1",
					agentId: mockAgentId,
					startDate: "2024-01-15T00:00:00.000Z",
					endDate: "2024-01-17T23:59:59.999Z",
					absenceType: "Urlaub",
					description: "Jahresurlaub",
					isFullDay: true
				},
				{
					id: "absence2",
					agentId: mockAgentId,
					startDate: "2024-02-01T00:00:00.000Z",
					endDate: "2024-02-01T23:59:59.999Z",
					absenceType: "Krankheit",
					description: null,
					isFullDay: true
				}
			];

			mockAgentService.getAgentAbsences.mockResolvedValue(mockAbsences);

			const event = createMockRequestEvent();
			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.absences).toEqual(mockAbsences);
			expect(mockAgentService.getAgentAbsences).toHaveBeenCalledWith(
				mockAgentId,
				undefined,
				undefined
			);
		});

		it("should support date filtering with query parameters", async () => {
			const mockAbsences = [
				{
					id: "absence1",
					agentId: mockAgentId,
					startDate: "2024-01-15T00:00:00.000Z",
					endDate: "2024-01-17T23:59:59.999Z",
					absenceType: "Urlaub",
					description: "Jahresurlaub",
					isFullDay: true
				}
			];

			mockAgentService.getAgentAbsences.mockResolvedValue(mockAbsences);

			const event = createMockRequestEvent({
				url: new URL(
					"http://localhost:3000/api/tenants/123/agents/agent-123/absences?startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-31T23:59:59.999Z"
				)
			});

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.absences).toEqual(mockAbsences);
			expect(mockAgentService.getAgentAbsences).toHaveBeenCalledWith(
				mockAgentId,
				"2024-01-01T00:00:00.000Z",
				"2024-01-31T23:59:59.999Z"
			);
		});

		it("should allow staff to view absences", async () => {
			const mockAbsences = [
				{
					id: "absence1",
					agentId: mockAgentId,
					startDate: "2024-01-15T00:00:00.000Z",
					endDate: "2024-01-17T23:59:59.999Z",
					absenceType: "Urlaub",
					description: "Jahresurlaub",
					isFullDay: true
				}
			];

			mockAgentService.getAgentAbsences.mockResolvedValue(mockAbsences);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						role: "STAFF",
						tenantId: mockTenantId
					}
				}
			});

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.absences).toEqual(mockAbsences);
		});

		it("should allow global admin to view absences for any tenant", async () => {
			const mockAbsences = [
				{
					id: "absence1",
					agentId: mockAgentId,
					startDate: "2024-01-15T00:00:00.000Z",
					endDate: "2024-01-17T23:59:59.999Z",
					absenceType: "Urlaub",
					description: "Jahresurlaub",
					isFullDay: true
				}
			];

			mockAgentService.getAgentAbsences.mockResolvedValue(mockAbsences);

			const event = createMockRequestEvent({
				locals: {
					user: {
						userId: "user123",
						role: "GLOBAL_ADMIN",
						tenantId: "different-tenant"
					}
				}
			});

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.absences).toEqual(mockAbsences);
		});

		it("should reject unauthenticated requests", async () => {
			const event = createMockRequestEvent({
				locals: { user: null }
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
					}
				}
			});

			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.error).toBe("Insufficient permissions");
		});

		it("should handle validation errors", async () => {
			mockAgentService.getAgentAbsences.mockRejectedValue(
				new ValidationError("Invalid date format")
			);

			const event = createMockRequestEvent();
			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe("Invalid date format");
		});

		it("should handle not found errors", async () => {
			mockAgentService.getAgentAbsences.mockRejectedValue(new NotFoundError("Agent not found"));

			const event = createMockRequestEvent();
			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(404);
			expect(data.error).toBe("Agent not found");
		});

		it("should handle internal server errors", async () => {
			mockAgentService.getAgentAbsences.mockRejectedValue(new Error("Database error"));

			const event = createMockRequestEvent();
			const response = await GET(event);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe("Internal server error");
		});
	});
});
