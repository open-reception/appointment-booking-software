/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../+server";
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
import { ValidationError, NotFoundError } from "$lib/server/utils/errors";

describe("Appointment API Routes", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockClientId = "123e4567-e89b-12d3-a456-426614174001";
  const mockChannelId = "123e4567-e89b-12d3-a456-426614174002";
  const mockAppointmentService = {
    queryAppointments: vi.fn(),
    createAppointment: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (AppointmentService.forTenant as any).mockResolvedValue(mockAppointmentService);
  });

  function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    return {
      params: { id: mockTenantId },
      locals: {
        user: {
          userId: "user123",
          sessionId: "session123",
          role: "TENANT_ADMIN",
          tenantId: mockTenantId,
        },
      },
      request: {
        json: vi.fn().mockResolvedValue({
          clientId: mockClientId,
          channelId: mockChannelId,
          appointmentDate: "2024-12-01T10:00:00Z",
          expiryDate: "2024-12-31",
          title: "Test Appointment",
        }),
      } as any,
      url: new URL("http://localhost?startDate=2024-12-01T00:00:00Z&endDate=2024-12-31T23:59:59Z"),
      ...overrides,
    } as RequestEvent;
  }

  describe("POST /api/tenants/{id}/appointments", () => {
    it("should create appointment successfully", async () => {
      const mockAppointment = {
        id: "appt123",
        clientId: mockClientId,
        channelId: mockChannelId,
        appointmentDate: "2024-12-01T10:00:00Z",
        expiryDate: "2024-12-31",
        title: "Test Appointment",
        status: "NEW",
      };

      mockAppointmentService.createAppointment.mockResolvedValue(mockAppointment);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const result = await response.json();

      expect(response.status).toBe(201);
      expect(result.message).toBe("Appointment created successfully");
      expect(result.appointment).toEqual(mockAppointment);
      expect(mockAppointmentService.createAppointment).toHaveBeenCalledWith({
        clientId: mockClientId,
        channelId: mockChannelId,
        appointmentDate: "2024-12-01T10:00:00Z",
        expiryDate: "2024-12-31",
        title: "Test Appointment",
      });
    });

    it("should return 401 if user is not authenticated", async () => {
      const event = createMockRequestEvent({ locals: {} });
      const response = await POST(event);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBe("Authentication required");
    });

    it("should return 403 if user has insufficient permissions", async () => {
      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            sessionId: "session123",
            role: "CLIENT",
            tenantId: "different-tenant",
          } as any,
        },
      });
      const response = await POST(event);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toBe("Insufficient permissions");
    });

    it("should allow global admin to create appointments for any tenant", async () => {
      const mockAppointment = {
        id: "appt123",
        clientId: mockClientId,
        channelId: mockChannelId,
        appointmentDate: "2024-12-01T10:00:00Z",
        expiryDate: "2024-12-31",
        title: "Test Appointment",
        status: "NEW",
      };

      mockAppointmentService.createAppointment.mockResolvedValue(mockAppointment);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "admin123",
            sessionId: "session456",
            role: "GLOBAL_ADMIN",
            tenantId: "different-tenant",
          } as any,
        },
      });

      const response = await POST(event);
      expect(response.status).toBe(201);
    });

    it("should allow staff to create appointments for their tenant", async () => {
      const mockAppointment = {
        id: "appt123",
        clientId: mockClientId,
        channelId: mockChannelId,
        appointmentDate: "2024-12-01T10:00:00Z",
        expiryDate: "2024-12-31",
        title: "Test Appointment",
        status: "NEW",
      };

      mockAppointmentService.createAppointment.mockResolvedValue(mockAppointment);

      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "staff123",
            sessionId: "session789",
            role: "STAFF",
            tenantId: mockTenantId,
          } as any,
        },
      });

      const response = await POST(event);
      expect(response.status).toBe(201);
    });

    it("should return 422 for validation errors", async () => {
      mockAppointmentService.createAppointment.mockRejectedValue(
        new ValidationError("Invalid data"),
      );

      const event = createMockRequestEvent();
      const response = await POST(event);
      const result = await response.json();

      expect(response.status).toBe(422);
      expect(result.error).toBe("Invalid data");
    });

    it("should return 404 for not found errors", async () => {
      mockAppointmentService.createAppointment.mockRejectedValue(
        new NotFoundError("Client not found"),
      );

      const event = createMockRequestEvent();
      const response = await POST(event);
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.error).toBe("Client not found");
    });

    it("should return 409 for conflict errors", async () => {
      mockAppointmentService.createAppointment.mockRejectedValue(new Error("Time slot conflict"));

      const event = createMockRequestEvent();
      const response = await POST(event);
      const result = await response.json();

      expect(response.status).toBe(409);
      expect(result.error).toBe("Time slot conflict");
    });
  });

  describe("GET /api/tenants/{id}/appointments", () => {
    it("should get appointments successfully", async () => {
      const mockAppointments = [
        {
          id: "appt1",
          clientId: mockClientId,
          channelId: mockChannelId,
          appointmentDate: "2024-12-01T10:00:00Z",
          expiryDate: "2024-12-31",
          title: "Appointment 1",
          status: "NEW",
          client: { id: mockClientId, email: "test@example.com" },
          channel: { id: mockChannelId, names: ["Room 1"] },
        },
      ];

      mockAppointmentService.queryAppointments.mockResolvedValue(mockAppointments);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.appointments).toEqual(mockAppointments);
      expect(mockAppointmentService.queryAppointments).toHaveBeenCalledWith({
        startDate: "2024-12-01T00:00:00Z",
        endDate: "2024-12-31T23:59:59Z",
      });
    });

    it("should return 401 if user is not authenticated", async () => {
      const event = createMockRequestEvent({
        locals: {},
      });

      const response = await GET(event);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBe("Authentication required");
    });

    it("should return 403 if user has insufficient permissions", async () => {
      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "user123",
            sessionId: "session123",
            role: "CLIENT",
            tenantId: "different-tenant",
          } as any,
        },
      });

      const response = await GET(event);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toBe("Insufficient permissions");
    });

    it("should return 422 if startDate or endDate is missing", async () => {
      const event = createMockRequestEvent({
        url: new URL("http://localhost?startDate=2024-12-01T00:00:00Z"),
      });

      const response = await GET(event);
      const result = await response.json();

      expect(response.status).toBe(422);
      expect(result.error).toBe("startDate and endDate are required");
    });

    it("should include optional filters in query", async () => {
      mockAppointmentService.queryAppointments.mockResolvedValue([]);

      const event = createMockRequestEvent({
        url: new URL(
          "http://localhost?startDate=2024-12-01T00:00:00Z&endDate=2024-12-31T23:59:59Z&channelId=" +
            mockChannelId +
            "&status=CONFIRMED",
        ),
      });

      await GET(event);

      expect(mockAppointmentService.queryAppointments).toHaveBeenCalledWith({
        startDate: "2024-12-01T00:00:00Z",
        endDate: "2024-12-31T23:59:59Z",
        channelId: mockChannelId,
        status: "CONFIRMED",
      });
    });

    it("should return 422 for validation errors", async () => {
      mockAppointmentService.queryAppointments.mockRejectedValue(
        new ValidationError("Invalid query"),
      );

      const event = createMockRequestEvent();
      const response = await GET(event);
      const result = await response.json();

      expect(response.status).toBe(422);
      expect(result.error).toBe("Invalid query");
    });
  });
});
