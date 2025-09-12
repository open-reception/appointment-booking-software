/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../+server";
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

describe("Agent API Routes", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockAgentService = {
    getAllAgents: vi.fn(),
    createAgent: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (AgentService.forTenant as any).mockResolvedValue(mockAgentService);
  });

  function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    return {
      params: { id: mockTenantId },
      locals: {
        user: {
          userId: "user123",
          role: "TENANT_ADMIN",
          tenantId: mockTenantId,
        },
      },
      request: {
        json: vi.fn().mockResolvedValue({
          name: "Test Agent",
          description: "Test Description",
        }),
      } as any,
      ...overrides,
    } as RequestEvent;
  }

  describe("GET /api/tenants/[id]/agents", () => {
    it("should return agents for authenticated tenant admin", async () => {
      const mockAgents = [
        {
          id: "agent1",
          name: "Agent 1",
          description: "Description 1",
          logo: null,
        },
      ];

      mockAgentService.getAllAgents.mockResolvedValue(mockAgents);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toEqual(mockAgents);
      expect(mockAgentService.getAllAgents).toHaveBeenCalledOnce();
    });

    it("should allow staff to view agents", async () => {
      const mockAgents = [
        {
          id: "agent1",
          name: "Agent 1",
          description: "Description 1",
          logo: null,
        },
      ];

      mockAgentService.getAllAgents.mockResolvedValue(mockAgents);

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
      expect(data.agents).toEqual(mockAgents);
    });

    it("should allow global admin to view any tenant's agents", async () => {
      const mockAgents = [
        {
          id: "agent1",
          name: "Agent 1",
          description: "Description 1",
          logo: null,
        },
      ];

      mockAgentService.getAllAgents.mockResolvedValue(mockAgents);

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
      expect(data.agents).toEqual(mockAgents);
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

    it("should handle missing tenant ID", async () => {
      const event = createMockRequestEvent({
        params: { id: undefined },
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("No tenant id given");
    });

    it("should handle service errors", async () => {
      mockAgentService.getAllAgents.mockRejectedValue(new NotFoundError("Tenant not found"));

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Tenant not found");
    });

    it("should handle internal server errors", async () => {
      mockAgentService.getAllAgents.mockRejectedValue(new Error("Database error"));

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("POST /api/tenants/[id]/agents", () => {
    it("should create agent for authenticated tenant admin", async () => {
      const mockAgent = {
        id: "agent1",
        name: "Test Agent",
        description: "Test Description",
        logo: null,
      };

      mockAgentService.createAgent.mockResolvedValue(mockAgent);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe("Agent created successfully");
      expect(data.agent).toEqual(mockAgent);
      expect(mockAgentService.createAgent).toHaveBeenCalledWith({
        name: "Test Agent",
        description: "Test Description",
      });
    });

    it("should allow global admin to create agents for any tenant", async () => {
      const mockAgent = {
        id: "agent1",
        name: "Test Agent",
        description: "Test Description",
        logo: null,
      };

      mockAgentService.createAgent.mockResolvedValue(mockAgent);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "GLOBAL_ADMIN",
            tenantId: "different-tenant",
          } as any,
        },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBe("Agent created successfully");
      expect(data.agent).toEqual(mockAgent);
    });

    it("should reject staff users from creating agents", async () => {
      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "STAFF",
            tenantId: mockTenantId,
          } as any,
        },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Insufficient permissions");
      expect(mockAgentService.createAgent).not.toHaveBeenCalled();
    });

    it("should reject unauthenticated requests", async () => {
      const event = createMockRequestEvent({
        locals: { user: null } as any,
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication required");
    });

    it("should handle validation errors", async () => {
      mockAgentService.createAgent.mockRejectedValue(new ValidationError("Invalid agent name"));

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid agent name");
    });

    it("should handle not found errors", async () => {
      mockAgentService.createAgent.mockRejectedValue(new NotFoundError("Tenant not found"));

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Tenant not found");
    });

    it("should handle internal server errors", async () => {
      mockAgentService.createAgent.mockRejectedValue(new Error("Database error"));

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should handle missing tenant ID", async () => {
      const event = createMockRequestEvent({
        params: { id: undefined },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("No tenant id given");
    });
  });
});
