/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE, PUT } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/server/services/appointment-service", () => ({
  AppointmentService: {
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

vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: vi.fn(),
}));

import { AppointmentService } from "$lib/server/services/appointment-service";
import { NotFoundError, AuthenticationError, AuthorizationError } from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";

describe("Appointment Detail API Routes", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockAppointmentId = "456e7890-e12b-34d5-a678-901234567890";
  const mockAppointmentService = {
    getAppointmentById: vi.fn(),
    updateAppointmentByStaff: vi.fn(),
    deleteAppointment: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (AppointmentService.forTenant as any).mockResolvedValue(mockAppointmentService);
    // Default: checkPermission passes
    vi.mocked(checkPermission).mockImplementation(() => {});
  });

  function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    return {
      params: { id: mockTenantId, appointmentId: mockAppointmentId },
      locals: {
        user: {
          userId: "user123",
          role: "TENANT_ADMIN",
          tenantId: mockTenantId,
        },
      } as any,
      ...overrides,
    } as RequestEvent;
  }

  function createMockRequest(body: unknown): Request {
    return { json: async () => body } as any;
  }

  describe("PUT /api/tenants/[id]/appointments/[appointmentId]", () => {
    it("should update the appointment successfully", async () => {
      mockAppointmentService.updateAppointmentByStaff.mockResolvedValue({
        agentId: "agent-456",
        appointmentDate: new Date("2024-01-15T11:00:00.000Z"),
      });

      const event = createMockRequestEvent({
        request: createMockRequest({
          agentId: "agent-456",
          appointmentDate: "2024-01-15T11:00:00.000Z",
          clientEmail: "client@example.com",
          clientLanguage: "de",
        }),
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agentId).toBe("agent-456");
      expect(data.appointmentDate).toBe("2024-01-15T11:00:00.000Z");
      expect(mockAppointmentService.updateAppointmentByStaff).toHaveBeenCalledWith(
        mockAppointmentId,
        { agentId: "agent-456", appointmentDate: "2024-01-15T11:00:00.000Z" },
        "client@example.com",
        "de",
      );
    });

    it("should return 400 for invalid request payload", async () => {
      const event = createMockRequestEvent({
        request: createMockRequest({ agentId: "agent-456" }),
      });

      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(422);
      expect(result.error).toContain("Invalid request data");
      expect(mockAppointmentService.updateAppointmentByStaff).not.toHaveBeenCalled();
    });

    it("should return 403 when permission is denied", async () => {
      vi.mocked(checkPermission).mockImplementationOnce(() => {
        throw new AuthorizationError("Insufficient permissions");
      });

      const event = createMockRequestEvent({
        request: createMockRequest({
          agentId: "agent-456",
          appointmentDate: "2024-01-15T11:00:00.000Z",
        }),
      });

      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toBe("Insufficient permissions");
      expect(mockAppointmentService.updateAppointmentByStaff).not.toHaveBeenCalled();
    });

    it("should return 403 when global admin tries to update appointments", async () => {
      vi.mocked(checkPermission).mockImplementationOnce(() => {
        throw new AuthorizationError("Insufficient permissions");
      });

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "GLOBAL_ADMIN",
            tenantId: "different-tenant",
          },
        } as any,
        request: createMockRequest({
          agentId: "agent-456",
          appointmentDate: "2024-01-15T11:00:00.000Z",
        }),
      });

      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toBe("Insufficient permissions");
      expect(mockAppointmentService.updateAppointmentByStaff).not.toHaveBeenCalled();
    });

    it("should return 401 for unauthenticated requests", async () => {
      vi.mocked(checkPermission).mockImplementationOnce(() => {
        throw new AuthenticationError("Authentication required");
      });

      const event = createMockRequestEvent({
        locals: { user: null } as any,
        request: createMockRequest({
          agentId: "agent-456",
          appointmentDate: "2024-01-15T11:00:00.000Z",
        }),
      });

      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBe("Authentication required");
      expect(mockAppointmentService.updateAppointmentByStaff).not.toHaveBeenCalled();
    });

    it("should return 404 when appointment is not found", async () => {
      mockAppointmentService.updateAppointmentByStaff.mockRejectedValue(
        new NotFoundError("Appointment not found"),
      );

      const event = createMockRequestEvent({
        request: createMockRequest({
          agentId: "agent-456",
          appointmentDate: "2024-01-15T11:00:00.000Z",
        }),
      });

      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.error).toBe("Appointment not found");
    });

    it("should return 422 for missing tenant ID", async () => {
      const event = createMockRequestEvent({
        params: { id: undefined, appointmentId: mockAppointmentId },
        request: createMockRequest({
          agentId: "agent-456",
          appointmentDate: "2024-01-15T11:00:00.000Z",
        }),
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID and appointment ID are required");
    });

    it("should return 422 for missing appointment ID", async () => {
      const event = createMockRequestEvent({
        params: { id: mockTenantId, appointmentId: undefined },
        request: createMockRequest({
          agentId: "agent-456",
          appointmentDate: "2024-01-15T11:00:00.000Z",
        }),
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID and appointment ID are required");
    });

    it("should return 500 for internal service errors", async () => {
      mockAppointmentService.updateAppointmentByStaff.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockRequestEvent({
        request: createMockRequest({
          agentId: "agent-456",
          appointmentDate: "2024-01-15T11:00:00.000Z",
        }),
      });

      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.error).toBe("Internal server error");
    });
  });

  describe("DELETE /api/tenants/[id]/appointments/[appointmentId]", () => {
    it("should delete appointment for tenant admin", async () => {
      mockAppointmentService.deleteAppointment.mockResolvedValue(true);

      const event = createMockRequestEvent();
      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Appointment deleted successfully");
      expect(mockAppointmentService.deleteAppointment).toHaveBeenCalledWith(mockAppointmentId);
    });

    it("should allow global admin to delete any tenant's appointments", async () => {
      mockAppointmentService.deleteAppointment.mockResolvedValue(true);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "GLOBAL_ADMIN",
            tenantId: "different-tenant",
          },
        } as any,
      });

      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Appointment deleted successfully");
    });

    it("should return 403 for staff users trying to delete appointments", async () => {
      vi.mocked(checkPermission).mockImplementationOnce(() => {
        throw new AuthorizationError("Insufficient permissions");
      });

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "STAFF",
            tenantId: mockTenantId,
          },
        } as any,
      });

      const response = await DELETE(event);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toBe("Insufficient permissions");
      expect(mockAppointmentService.deleteAppointment).not.toHaveBeenCalled();
    });

    it("should return 401 for unauthenticated requests", async () => {
      vi.mocked(checkPermission).mockImplementationOnce(() => {
        throw new AuthenticationError("Authentication required");
      });

      const event = createMockRequestEvent({ locals: { user: null } as any });
      const response = await DELETE(event);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBe("Authentication required");
    });

    it("should handle missing tenant ID", async () => {
      const event = createMockRequestEvent({
        params: { id: undefined, appointmentId: mockAppointmentId },
      });

      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID and appointment ID are required");
    });

    it("should handle missing appointment ID", async () => {
      const event = createMockRequestEvent({
        params: { id: mockTenantId, appointmentId: undefined },
      });

      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID and appointment ID are required");
    });

    it("should handle appointment not found", async () => {
      mockAppointmentService.deleteAppointment.mockResolvedValue(false);

      const event = createMockRequestEvent();
      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Appointment not found");
    });

    it("should handle service errors", async () => {
      mockAppointmentService.deleteAppointment.mockRejectedValue(
        new NotFoundError("Appointment not found"),
      );

      const event = createMockRequestEvent();
      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Appointment not found");
    });

    it("should handle internal server errors", async () => {
      mockAppointmentService.deleteAppointment.mockRejectedValue(new Error("Database error"));

      const event = createMockRequestEvent();
      const response = await DELETE(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
