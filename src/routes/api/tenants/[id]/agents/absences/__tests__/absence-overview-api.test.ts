/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RequestEvent } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../+server";

// Mock dependencies
vi.mock("$lib/server/services/agent-service", () => ({
  AgentService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/logger", () => ({
  default: {
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

import { AgentService } from "$lib/server/services/agent-service";
import { NotFoundError } from "$lib/server/utils/errors";
// import { NotFoundError } from "$lib/server/utils/errors";

describe("Agent Absence Detail API Routes", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockAbsenceId = "absence-456";
  const mockAgentService = {
    getAbsences: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (AgentService.forTenant as any).mockResolvedValue(mockAgentService);
  });

  function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    return {
      params: { id: mockTenantId },
      searchParams: new URLSearchParams(),
      locals: {
        user: {
          userId: "user123",
          role: "TENANT_ADMIN",
          tenantId: mockTenantId,
        },
      },
      request: {
        json: vi.fn().mockResolvedValue({
          startDate: "2024-01-15T00:00:00.000Z",
          endDate: "2024-01-17T23:59:59.999Z",
          absenceType: "Urlaub",
          description: "Jahresurlaub",
          isFullDay: true,
        }),
      } as any,
      url: new URL("http://localhost:3000/api/tenants/123/agents/absences"),
      ...overrides,
    } as RequestEvent;
  }

  describe("GET /api/tenants/[id]/agents/absences", () => {
    it("should return absences for authenticated tenant admin", async () => {
      const mockAbsences = [
        {
          id: mockAbsenceId,
          startDate: "2024-01-15T00:00:00.000Z",
          endDate: "2024-01-17T23:59:59.999Z",
          absenceType: "Urlaub",
          description: "Jahresurlaub",
          isFullDay: true,
        },
      ];

      mockAgentService.getAbsences.mockResolvedValue(mockAbsences);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.absences).toEqual(mockAbsences);
      expect(mockAgentService.getAbsences).toHaveBeenCalled();
    });
  });

  it("should allow staff to view absence details", async () => {
    const mockAbsences = [
      {
        id: mockAbsenceId,
        startDate: "2024-01-15T00:00:00.000Z",
        endDate: "2024-01-17T23:59:59.999Z",
        absenceType: "Urlaub",
        description: "Jahresurlaub",
        isFullDay: true,
      },
    ];

    mockAgentService.getAbsences.mockResolvedValue(mockAbsences);

    const event = createMockRequestEvent({
      locals: {
        user: {
          userId: "user123",
          role: "STAFF",
          tenantId: mockTenantId,
        } as any,
      },
    });
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.absences).toEqual(mockAbsences);
  });

  it("should allow global admin to view absence details for any tenant", async () => {
    const mockAbsences = [
      {
        id: mockAbsenceId,
        startDate: "2024-01-15T00:00:00.000Z",
        endDate: "2024-01-17T23:59:59.999Z",
        absenceType: "Urlaub",
        description: "Jahresurlaub",
        isFullDay: true,
      },
    ];

    mockAgentService.getAbsences.mockResolvedValue(mockAbsences);

    const event = createMockRequestEvent({
      locals: {
        user: {
          userId: "user123",
          role: "GLOBAL_ADMIN",
          tenantId: "different-tenant",
        } as any,
      },
    });

    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.absences).toEqual(mockAbsences);
  });

  it("should return empty list when no absences found", async () => {
    mockAgentService.getAbsences.mockResolvedValue(null);

    const event = createMockRequestEvent();
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.absences).toEqual([]);
  });

  it("should reject unauthenticated requests", async () => {
    const event = createMockRequestEvent({
      locals: { user: null } as any,
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
          tenantId: "different-tenant",
        } as any,
      },
    });

    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Insufficient permissions");
  });

  it("should handle service errors", async () => {
    mockAgentService.getAbsences.mockRejectedValue(new NotFoundError("Absences not found"));

    const event = createMockRequestEvent();
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Absences not found");
  });
});
