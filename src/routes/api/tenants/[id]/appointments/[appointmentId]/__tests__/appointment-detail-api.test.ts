/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "../+server";
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
