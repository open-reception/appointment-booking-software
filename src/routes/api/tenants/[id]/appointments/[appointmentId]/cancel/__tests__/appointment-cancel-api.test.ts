/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT } from "../+server";
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

import { AppointmentService } from "$lib/server/services/appointment-service";
import { NotFoundError } from "$lib/server/utils/errors";

describe("Appointment Cancel API", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockAppointmentId = "123e4567-e89b-12d3-a456-426614174003";
  const mockAppointmentService = {
    cancelAppointment: vi.fn(),
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
          tenantId: mockTenantId,
        },
      },
      ...overrides,
    } as RequestEvent;
  }

  describe("PUT /api/tenants/{id}/appointments/{appointmentId}/cancel", () => {
    it("should cancel appointment successfully", async () => {
      const mockCancelledAppointment = {
        id: mockAppointmentId,
        clientId: "client123",
        channelId: "channel123",
        appointmentDate: "2024-12-01T10:00:00Z",
        expiryDate: "2024-12-31",
        title: "Test Appointment",
        status: "REJECTED",
      };

      mockAppointmentService.cancelAppointment.mockResolvedValue(mockCancelledAppointment);

      const event = createMockRequestEvent();
      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.message).toBe("Appointment cancelled successfully");
      expect(result.appointment).toEqual(mockCancelledAppointment);
      expect(mockAppointmentService.cancelAppointment).toHaveBeenCalledWith(mockAppointmentId);
    });

    it("should return 401 if user is not authenticated", async () => {
      const event = createMockRequestEvent({ locals: {} });
      const response = await PUT(event);
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
            tenantId: "different-tenant",
          } as any,
        },
      });
      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toBe("Insufficient permissions");
    });

    it("should allow global admin to cancel appointments for any tenant", async () => {
      const mockCancelledAppointment = {
        id: mockAppointmentId,
        status: "REJECTED",
      };

      mockAppointmentService.cancelAppointment.mockResolvedValue(mockCancelledAppointment);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "admin123",
            sessionId: "session789",
            role: "GLOBAL_ADMIN",
            tenantId: "different-tenant",
          } as any,
        },
      });

      const response = await PUT(event);
      expect(response.status).toBe(200);
    });

    it("should allow staff to cancel appointments for their tenant", async () => {
      const mockCancelledAppointment = {
        id: mockAppointmentId,
        status: "REJECTED",
      };

      mockAppointmentService.cancelAppointment.mockResolvedValue(mockCancelledAppointment);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "staff123",
            sessionId: "session101",
            role: "STAFF",
            tenantId: mockTenantId,
          } as any,
        },
      });

      const response = await PUT(event);
      expect(response.status).toBe(200);
    });

    it("should return 422 if tenant ID or appointment ID is missing", async () => {
      const event = createMockRequestEvent({
        params: { id: mockTenantId },
      });

      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(422);
      expect(result.error).toBe("Tenant ID and appointment ID are required");
    });

    it("should return 404 for not found errors", async () => {
      mockAppointmentService.cancelAppointment.mockRejectedValue(
        new NotFoundError("Appointment not found"),
      );

      const event = createMockRequestEvent();
      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.error).toBe("Appointment not found");
    });

    it("should return 500 for unexpected errors", async () => {
      mockAppointmentService.cancelAppointment.mockRejectedValue(new Error("Database error"));

      const event = createMockRequestEvent();
      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.error).toBe("Internal server error");
    });
  });
});
