/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, DELETE } from "../+server";
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
import { NotFoundError, ValidationError } from "$lib/server/utils/errors";

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

  const mockAppointment = {
    id: mockAppointmentId,
    tunnelId: "tunnel-123",
    channelId: "channel-123",
    appointmentDate: "2024-01-01T10:00:00.000Z",
    expiryDate: null,
    status: "CONFIRMED",
    encryptedData: null,
    dataKey: null,
    isEncrypted: true,
    encryptedPayload: "encrypted-payload",
    iv: "iv-data",
    authTag: "auth-tag",
    createdAt: "2024-01-01T09:00:00.000Z",
    updatedAt: "2024-01-01T09:00:00.000Z",
  } as any;

  describe("GET /api/tenants/[id]/appointments/[appointmentId]", () => {
    it("should return appointment for authenticated user", async () => {
      mockAppointmentService.getAppointmentById.mockResolvedValue(mockAppointment);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.appointment).toEqual(mockAppointment);
      expect(mockAppointmentService.getAppointmentById).toHaveBeenCalledWith(mockAppointmentId);
    });

    it("should allow staff to view appointments", async () => {
      mockAppointmentService.getAppointmentById.mockResolvedValue(mockAppointment);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "STAFF",
            tenantId: mockTenantId,
          },
        } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.appointment).toEqual(mockAppointment);
    });

    it("should allow global admin to view any tenant's appointments", async () => {
      mockAppointmentService.getAppointmentById.mockResolvedValue(mockAppointment);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "GLOBAL_ADMIN",
            tenantId: "different-tenant",
          },
        } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.appointment).toEqual(mockAppointment);
    });

    it("should handle missing tenant ID", async () => {
      const event = createMockRequestEvent({
        params: { id: undefined, appointmentId: mockAppointmentId },
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID and appointment ID are required");
    });

    it("should handle missing appointment ID", async () => {
      const event = createMockRequestEvent({
        params: { id: mockTenantId, appointmentId: undefined },
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID and appointment ID are required");
    });

    it("should handle appointment not found", async () => {
      mockAppointmentService.getAppointmentById.mockResolvedValue(null);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Appointment not found");
    });

    it("should handle service errors", async () => {
      mockAppointmentService.getAppointmentById.mockRejectedValue(
        new ValidationError("Invalid appointment ID"),
      );

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Invalid appointment ID");
    });

    it("should handle internal server errors", async () => {
      mockAppointmentService.getAppointmentById.mockRejectedValue(new Error("Database error"));

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
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
