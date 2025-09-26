/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../+server";
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
import type { SelectAppointment } from "$lib/server/db/tenant-schema";

describe("Appointments API Route", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockAppointmentService = {
    getAppointmentsByTimeRange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (AppointmentService.forTenant as any).mockResolvedValue(mockAppointmentService);
  });

  function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    const searchParams = new URLSearchParams();
    searchParams.set("startDate", "2024-01-01T00:00:00.000Z");
    searchParams.set("endDate", "2024-01-07T23:59:59.999Z");

    return {
      params: { id: mockTenantId },
      url: {
        searchParams,
      } as any,
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

  describe("GET /api/tenants/[id]/appointments", () => {
    it("should return appointments for authenticated tenant admin", async () => {
      const mockAppointments = [
        {
          id: "appointment-1",
          tunnelId: "tunnel-1",
          channelId: "channel-1",
          appointmentDate: "2024-01-01T10:00:00.000Z",
          status: "CONFIRMED",
          isEncrypted: true,
          encryptedPayload: "encrypted-data",
          iv: "iv-data",
          authTag: "auth-tag",
          createdAt: "2024-01-01T09:00:00.000Z",
          updatedAt: "2024-01-01T09:00:00.000Z",
        },
      ];

      mockAppointmentService.getAppointmentsByTimeRange.mockResolvedValue(mockAppointments);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.appointments).toEqual(mockAppointments);
      expect(data.meta).toEqual({
        count: 1,
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-07T23:59:59.999Z",
      });
      expect(mockAppointmentService.getAppointmentsByTimeRange).toHaveBeenCalledWith(
        new Date("2024-01-01T00:00:00.000Z"),
        new Date("2024-01-07T23:59:59.999Z"),
      );
    });

    it("should allow staff to view appointments", async () => {
      const mockAppointments: SelectAppointment[] = [];
      mockAppointmentService.getAppointmentsByTimeRange.mockResolvedValue(mockAppointments);

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
      expect(data.appointments).toEqual(mockAppointments);
    });

    it("should allow global admin to view any tenant's appointments", async () => {
      const mockAppointments: SelectAppointment[] = [];
      mockAppointmentService.getAppointmentsByTimeRange.mockResolvedValue(mockAppointments);

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
      expect(data.appointments).toEqual(mockAppointments);
    });

    it("should return 401 for unauthenticated requests", async () => {
      const event = createMockRequestEvent({ locals: { user: null } as any });
      const response = await GET(event);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBe("Authentication required");
    });

    it("should return 403 for insufficient permissions", async () => {
      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            role: "STAFF",
            tenantId: "different-tenant",
          },
        } as any,
      });
      const response = await GET(event);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toBe("Insufficient permissions");
    });

    it("should handle missing tenant ID", async () => {
      const event = createMockRequestEvent({
        params: { id: undefined },
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID is required");
    });

    it("should handle missing startDate parameter", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("endDate", "2024-01-07T23:59:59.999Z");

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Both startDate and endDate query parameters are required");
    });

    it("should handle missing endDate parameter", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("startDate", "2024-01-01T00:00:00.000Z");

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Both startDate and endDate query parameters are required");
    });

    it("should handle invalid date format", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("startDate", "invalid-date");
      searchParams.set("endDate", "2024-01-07T23:59:59.999Z");

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe(
        "Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)",
      );
    });

    it("should handle startDate after endDate", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("startDate", "2024-01-07T00:00:00.000Z");
      searchParams.set("endDate", "2024-01-01T23:59:59.999Z");

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Start date must be before end date");
    });

    it("should handle date range exceeding 1 year", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("startDate", "2024-01-01T00:00:00.000Z");
      searchParams.set("endDate", "2025-01-02T23:59:59.999Z"); // More than 1 year

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Date range cannot exceed 1 year");
    });

    it("should handle service errors gracefully", async () => {
      mockAppointmentService.getAppointmentsByTimeRange.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should handle maximum allowed date range (1 year)", async () => {
      const startDate = "2024-01-01T00:00:00.000Z";
      const endDate = "2024-12-31T23:59:59.999Z"; // Exactly 1 year

      const searchParams = new URLSearchParams();
      searchParams.set("startDate", startDate);
      searchParams.set("endDate", endDate);

      const mockAppointments: SelectAppointment[] = [];
      mockAppointmentService.getAppointmentsByTimeRange.mockResolvedValue(mockAppointments);

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);

      expect(response.status).toBe(200);
      expect(mockAppointmentService.getAppointmentsByTimeRange).toHaveBeenCalledWith(
        new Date(startDate),
        new Date(endDate),
      );
    });

    it("should return empty appointments list when no appointments found", async () => {
      const mockAppointments: SelectAppointment[] = [];
      mockAppointmentService.getAppointmentsByTimeRange.mockResolvedValue(mockAppointments);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.appointments).toEqual([]);
      expect(data.meta.count).toBe(0);
    });

    it("should handle different timezone formats", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("startDate", "2024-01-01T00:00:00+01:00");
      searchParams.set("endDate", "2024-01-07T23:59:59+01:00");

      const mockAppointments: SelectAppointment[] = [];
      mockAppointmentService.getAppointmentsByTimeRange.mockResolvedValue(mockAppointments);

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);

      expect(response.status).toBe(200);
      expect(mockAppointmentService.getAppointmentsByTimeRange).toHaveBeenCalledWith(
        new Date("2024-01-01T00:00:00+01:00"),
        new Date("2024-01-07T23:59:59+01:00"),
      );
    });
  });
});
