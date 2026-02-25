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
import { ValidationError } from "$lib/server/utils/errors";

describe("Appointment Confirm API Route", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockAppointmentId = "456e7890-e12b-34d5-a678-901234567890";
  const mockAppointmentService = {
    confirmAppointment: vi.fn(),
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

  const mockConfirmedAppointment = {
    id: mockAppointmentId,
    tunnelId: "tunnel-123",
    channelId: "channel-123",
    appointmentDate: "2024-01-01T10:00:00.000Z",
    expiryDate: null,
    status: "CONFIRMED",
    encryptedData: null,
    dataKey: null,
    encryptedPayload: "encrypted-payload",
    iv: "iv-data",
    authTag: "auth-tag",
    createdAt: "2024-01-01T09:00:00.000Z",
    updatedAt: "2024-01-01T09:00:00.000Z",
  } as any;

  describe("PUT /api/tenants/[id]/appointments/[appointmentId]/confirm", () => {
    it("should confirm appointment for tenant admin", async () => {
      mockAppointmentService.confirmAppointment.mockResolvedValue(mockConfirmedAppointment);

      const event = createMockRequestEvent();
      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Appointment confirmed successfully");
      expect(data.appointment).toEqual(mockConfirmedAppointment);
      expect(mockAppointmentService.confirmAppointment).toHaveBeenCalledWith(
        mockAppointmentId,
        undefined,
        "en",
      );
    });

    it("should allow staff to confirm appointments", async () => {
      mockAppointmentService.confirmAppointment.mockResolvedValue(mockConfirmedAppointment);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "STAFF",
            tenantId: mockTenantId,
          },
        } as any,
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Appointment confirmed successfully");
      expect(data.appointment).toEqual(mockConfirmedAppointment);
    });

    it("should allow global admin to confirm any tenant's appointments", async () => {
      mockAppointmentService.confirmAppointment.mockResolvedValue(mockConfirmedAppointment);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "GLOBAL_ADMIN",
            tenantId: "different-tenant",
          },
        } as any,
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Appointment confirmed successfully");
      expect(data.appointment).toEqual(mockConfirmedAppointment);
    });

    it("should return 401 for unauthenticated requests", async () => {
      const event = createMockRequestEvent({ locals: { user: null } as any });
      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBe("Authentication required");
    });

    it("should return 403 for users from different tenant", async () => {
      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "STAFF",
            tenantId: "different-tenant",
          },
        } as any,
      });

      const response = await PUT(event);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toBe("Insufficient permissions");
    });

    it("should handle missing tenant ID", async () => {
      const event = createMockRequestEvent({
        params: { id: undefined, appointmentId: mockAppointmentId },
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID and appointment ID are required");
    });

    it("should handle missing appointment ID", async () => {
      const event = createMockRequestEvent({
        params: { id: mockTenantId, appointmentId: undefined },
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID and appointment ID are required");
    });

    it("should handle appointment not found or in wrong state", async () => {
      mockAppointmentService.confirmAppointment.mockRejectedValue(
        new ValidationError("Appointment not found or in wrong state"),
      );

      const event = createMockRequestEvent();
      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Appointment not found or in wrong state");
    });

    it("should handle service validation errors", async () => {
      mockAppointmentService.confirmAppointment.mockRejectedValue(
        new ValidationError("Appointment already confirmed"),
      );

      const event = createMockRequestEvent();
      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Appointment already confirmed");
    });

    it("should handle internal server errors", async () => {
      mockAppointmentService.confirmAppointment.mockRejectedValue(new Error("Database error"));

      const event = createMockRequestEvent();
      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
