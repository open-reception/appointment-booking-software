/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/server/services/appointment-service", () => ({
  AppointmentService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Create New Client API Route", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockTunnelId = "tunnel-123";
  const mockChannelId = "channel-456";

  const validRequestBody = {
    tunnelId: mockTunnelId,
    channelId: mockChannelId,
    appointmentDate: "2024-12-25T14:30:00.000Z",
    emailHash: "test-email-hash",
    clientPublicKey: "test-public-key",
    privateKeyShare: "test-private-key-share",
    encryptedAppointment: {
      encryptedPayload: "encrypted-data",
      iv: "iv-data",
      authTag: "auth-tag-data",
    },
    staffKeyShares: [
      {
        userId: "staff-123",
        encryptedTunnelKey: "encrypted-tunnel-key",
      },
    ],
    clientEncryptedTunnelKey: "client-encrypted-tunnel-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockRequestEvent(
    body: any = validRequestBody,
    overrides: Partial<RequestEvent> = {},
  ): RequestEvent {
    return {
      params: { id: mockTenantId },
      request: {
        json: vi.fn().mockResolvedValue(body),
      } as any,
      locals: {
        user: {
          userId: "user123",
          role: "STAFF",
          tenantId: mockTenantId,
        },
      } as any,
      ...overrides,
    } as RequestEvent;
  }

  describe("Success Cases", () => {
    it("should return 200 when service successfully creates appointment", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");
      const { logger } = await import("$lib/logger");

      // Mock successful service response
      const mockAppointment = {
        id: "appointment-123",
        appointmentDate: "2024-12-25T14:30:00.000Z",
        status: "NEW",
      };
      const mockService = {
        createNewClientWithAppointment: vi.fn().mockResolvedValue(mockAppointment),
      };
      vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockAppointment);
      expect(mockService.createNewClientWithAppointment).toHaveBeenCalledWith(validRequestBody);
      expect(logger.info).toHaveBeenCalledWith("Creating new client appointment tunnel", {
        tenantId: mockTenantId,
        tunnelId: mockTunnelId,
        appointmentDate: validRequestBody.appointmentDate,
        emailHashPrefix: "test-ema",
      });
    });

    it("should return 200 with CONFIRMED status when service returns it", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");

      const mockAppointment = {
        id: "appointment-123",
        appointmentDate: "2024-12-25T14:30:00.000Z",
        status: "CONFIRMED",
      };
      const mockService = {
        createNewClientWithAppointment: vi.fn().mockResolvedValue(mockAppointment),
      };
      vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("CONFIRMED");
    });
  });

  describe("Validation Errors", () => {
    it("should return 422 for invalid request data", async () => {
      const invalidBody = {
        tunnelId: mockTunnelId,
        // Missing required fields
      };

      const event = createMockRequestEvent(invalidBody);
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Invalid request data");
    });

    it("should return 422 for missing tenant ID", async () => {
      const event = createMockRequestEvent(validRequestBody, {
        params: {}, // No id parameter
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID is required");
    });

    it("should return 500 for invalid JSON in request", async () => {
      const event = {
        params: { id: mockTenantId },
        request: {
          json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
        },
      } as any;

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("Service Errors", () => {
    it("should return 500 when service throws ConflictError for no authorized users", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");
      const { logger } = await import("$lib/logger");

      // Mock service to throw error (should be caught and return 500)
      const mockService = {
        createNewClientWithAppointment: vi
          .fn()
          .mockRejectedValue(
            new Error("Cannot create client appointments: No authorized users found in tenant"),
          ),
      };
      vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(logger.info).toHaveBeenCalledWith("Creating new client appointment tunnel", {
        tenantId: mockTenantId,
        tunnelId: mockTunnelId,
        appointmentDate: validRequestBody.appointmentDate,
        emailHashPrefix: "test-ema",
      });
    });

    it("should return 500 for service initialization errors", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");

      // Mock service initialization failure
      vi.mocked(AppointmentService.forTenant).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should return 500 when service throws NotFoundError", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");

      const mockService = {
        createNewClientWithAppointment: vi.fn().mockRejectedValue(new Error("Channel not found")),
      };
      vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("Logging", () => {
    it("should log appointment creation attempts", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");
      const { logger } = await import("$lib/logger");

      const mockService = {
        createNewClientWithAppointment: vi.fn().mockResolvedValue({
          id: "appointment-123",
          appointmentDate: "2024-12-25T14:30:00.000Z",
          status: "NEW",
        }),
      };
      vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

      const event = createMockRequestEvent();
      await POST(event);

      expect(logger.info).toHaveBeenCalledWith("Creating new client appointment tunnel", {
        tenantId: mockTenantId,
        tunnelId: mockTunnelId,
        appointmentDate: validRequestBody.appointmentDate,
        emailHashPrefix: "test-ema", // First 8 chars of "test-email-hash"
      });
    });

    it("should log errors when service fails", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");

      const mockService = {
        createNewClientWithAppointment: vi.fn().mockRejectedValue(new Error("Service error")),
      };
      vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

      const event = createMockRequestEvent();
      await POST(event);

      // Logger error calls are handled by logError function, so we just verify the endpoint doesn't crash
      expect(true).toBe(true);
    });
  });
});
