/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT, DELETE } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

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
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";

describe("Agent Detail API Routes", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockAgentId = "agent-123";
  const mockAgentService = {
    getAgentById: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
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
          tenantId: mockTenantId,
        },
      },
      request: {
        json: vi.fn().mockResolvedValue({
          name: "Updated Agent",
          description: "Updated Description",
        }),
      } as any,
      ...overrides,
    } as RequestEvent;
  }

  describe("GET /api/tenants/[id]/agents/[agentId]", () => {
    it("should return agent details for authenticated tenant admin", async () => {
      const mockAgent = {
        id: mockAgentId,
        name: "Test Agent",
        description: "Test Description",
        logo: null,
      };

      mockAgentService.getAgentById.mockResolvedValue(mockAgent);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agent).toEqual(mockAgent);
      expect(mockAgentService.getAgentById).toHaveBeenCalledWith(mockAgentId);
    });

    it("should allow staff to view agent details", async () => {
      const mockAgent = {
        id: mockAgentId,
        name: "Test Agent",
        description: "Test Description",
        logo: null,
      };

      mockAgentService.getAgentById.mockResolvedValue(mockAgent);

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
      expect(data.agent).toEqual(mockAgent);
    });

    it("should allow global admin to view any tenant's agent", async () => {
      const mockAgent = {
        id: mockAgentId,
        name: "Test Agent",
        description: "Test Description",
        logo: null,
      };

      mockAgentService.getAgentById.mockResolvedValue(mockAgent);

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
      expect(data.agent).toEqual(mockAgent);
    });

    it("should return 404 when agent not found", async () => {
      mockAgentService.getAgentById.mockResolvedValue(null);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Agent not found");
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
  });

  describe("PUT /api/tenants/[id]/agents/[agentId]", () => {
    it("should update agent for authenticated tenant admin", async () => {
      const mockUpdatedAgent = {
        id: mockAgentId,
        name: "Updated Agent",
        description: "Updated Description",
        logo: null,
      };

      mockAgentService.updateAgent.mockResolvedValue(mockUpdatedAgent);

      const event = createMockRequestEvent();
      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Agent updated successfully");
      expect(data.agent).toEqual(mockUpdatedAgent);
      expect(mockAgentService.updateAgent).toHaveBeenCalledWith(mockAgentId, {
        name: "Updated Agent",
        description: "Updated Description",
      });
    });

    it("should allow global admin to update any tenant's agent", async () => {
      const mockUpdatedAgent = {
        id: mockAgentId,
        name: "Updated Agent",
        description: "Updated Description",
        logo: null,
      };

      mockAgentService.updateAgent.mockResolvedValue(mockUpdatedAgent);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "GLOBAL_ADMIN",
            tenantId: "different-tenant",
          } as any,
        },
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Agent updated successfully");
      expect(data.agent).toEqual(mockUpdatedAgent);
    });

    it("should reject staff users from updating agents", async () => {
      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "STAFF",
            tenantId: mockTenantId,
          } as any,
        },
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Insufficient permissions");
      expect(mockAgentService.updateAgent).not.toHaveBeenCalled();
    });

    it("should handle validation errors", async () => {
      mockAgentService.updateAgent.mockRejectedValue(new ValidationError("Invalid agent data"));

      const event = createMockRequestEvent();
      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid agent data");
    });

    it("should handle not found errors", async () => {
      mockAgentService.updateAgent.mockRejectedValue(new NotFoundError("Agent not found"));

      const event = createMockRequestEvent();
      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Agent not found");
    });
  });

  describe("DELETE /api/tenants/[id]/agents/[agentId]", () => {
    it("should delete agent for authenticated tenant admin", async () => {
      mockAgentService.deleteAgent.mockResolvedValue(true);

      const event = createMockRequestEvent();
      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Agent deleted successfully");
      expect(mockAgentService.deleteAgent).toHaveBeenCalledWith(mockAgentId);
    });

    it("should allow global admin to delete any tenant's agent", async () => {
      mockAgentService.deleteAgent.mockResolvedValue(true);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "GLOBAL_ADMIN",
            tenantId: "different-tenant",
          } as any,
        },
      });

      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Agent deleted successfully");
    });

    it("should reject staff users from deleting agents", async () => {
      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "STAFF",
            tenantId: mockTenantId,
          } as any,
        },
      });

      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Insufficient permissions");
      expect(mockAgentService.deleteAgent).not.toHaveBeenCalled();
    });

    it("should return 404 when agent not found", async () => {
      mockAgentService.deleteAgent.mockResolvedValue(false);

      const event = createMockRequestEvent();
      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Agent not found");
    });

    it("should handle service errors", async () => {
      mockAgentService.deleteAgent.mockRejectedValue(new NotFoundError("Agent not found"));

      const event = createMockRequestEvent();
      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Agent not found");
    });

    it("should handle internal server errors", async () => {
      mockAgentService.deleteAgent.mockRejectedValue(new Error("Database error"));

      const event = createMockRequestEvent();
      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
