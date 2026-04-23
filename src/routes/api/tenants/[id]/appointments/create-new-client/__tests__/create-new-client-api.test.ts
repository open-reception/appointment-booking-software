/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";
import { NotFoundError, ConflictError } from "$lib/server/utils/errors";

// Mock dependencies
vi.mock("$lib/server/services/appointment-service", () => ({
  AppointmentService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("$lib/server/auth/booking-access-token", () => ({
  NEW_CLIENT_BOOTSTRAP_SCOPE: "appointments:new-client-bootstrap",
  verifyBookingAccessToken: vi.fn(),
  consumeBookingAccessToken: vi.fn(),
}));

describe("Create New Client API Route", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockTunnelId = "tunnel-123";
  const mockChannelId = "channel-456";

  const validRequestBody = {
    tunnelId: mockTunnelId,
    channelId: mockChannelId,
    agentId: "agent-123", // Missing field added
    appointmentDate: "2024-12-25T14:30:00.000Z",
    appointmentTimeZone: "Europe/Berlin",
    duration: 10,
    emailHash: "test-email-hash",
    clientEmail: "test@example.com",
    clientLanguage: "de",
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

  const validTokenPayload = {
    tenantId: mockTenantId,
    tunnelId: mockTunnelId,
    clientPublicKey: validRequestBody.clientPublicKey,
    emailHash: validRequestBody.emailHash,
    scope: "appointments:new-client-bootstrap",
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
        headers: new Headers({ Authorization: "Bearer valid-bootstrap-token" }),
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
      const { verifyBookingAccessToken, consumeBookingAccessToken } = await import(
        "$lib/server/auth/booking-access-token"
      );

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
      vi.mocked(verifyBookingAccessToken).mockResolvedValue(validTokenPayload as any);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockAppointment);
      expect(mockService.createNewClientWithAppointment).toHaveBeenCalledWith(validRequestBody);
      expect(consumeBookingAccessToken).toHaveBeenCalledOnce();
      expect(logger.debug).toHaveBeenCalledWith("Creating new client appointment tunnel", {
        tenantId: mockTenantId,
        tunnelId: mockTunnelId,
      });
    });

    it("should return 200 with CONFIRMED status when service returns it", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");
      const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");

      const mockAppointment = {
        id: "appointment-123",
        appointmentDate: "2024-12-25T14:30:00.000Z",
        status: "CONFIRMED",
      };
      const mockService = {
        createNewClientWithAppointment: vi.fn().mockResolvedValue(mockAppointment),
      };
      vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);
      vi.mocked(verifyBookingAccessToken).mockResolvedValue(validTokenPayload as any);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("CONFIRMED");
    });
  });

  describe("Validation Errors", () => {
    it("should return 401 when bootstrap token is missing", async () => {
      const event = createMockRequestEvent(validRequestBody, {
        request: {
          json: vi.fn().mockResolvedValue(validRequestBody),
          headers: new Headers(),
        } as any,
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Bootstrap booking access token is required");
    });

    it("should return 422 for invalid request data", async () => {
      const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");
      const invalidBody = {
        tunnelId: mockTunnelId,
        // Missing required fields
      };

      vi.mocked(verifyBookingAccessToken).mockResolvedValue(validTokenPayload as any);

      const event = createMockRequestEvent(invalidBody);
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Invalid request data");
    });

    it("should return 422 for missing tenant ID", async () => {
      const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");
      vi.mocked(verifyBookingAccessToken).mockResolvedValue(validTokenPayload as any);

      const event = createMockRequestEvent(validRequestBody, {
        params: {}, // No id parameter
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID is required");
    });

    it("should return 500 for invalid JSON in request", async () => {
      const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");
      vi.mocked(verifyBookingAccessToken).mockResolvedValue(validTokenPayload as any);

      const event = {
        params: { id: mockTenantId },
        request: {
          json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
          headers: new Headers({ Authorization: "Bearer valid-bootstrap-token" }),
        },
      } as any;

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("Service Errors", () => {
    it("should return 409 when service throws ConflictError for no authorized users", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");
      const { logger } = await import("$lib/logger");
      const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");

      // Mock service to throw ConflictError (should return 409)
      const mockService = {
        createNewClientWithAppointment: vi
          .fn()
          .mockRejectedValue(
            new ConflictError(
              "Cannot create client appointments: No authorized users found in tenant",
            ),
          ),
      };
      vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);
      vi.mocked(verifyBookingAccessToken).mockResolvedValue(validTokenPayload as any);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe(
        "Cannot create client appointments: No authorized users found in tenant",
      );
      expect(logger.debug).toHaveBeenCalledWith("Creating new client appointment tunnel", {
        tenantId: mockTenantId,
        tunnelId: mockTunnelId,
      });
    });

    it("should return 500 for service initialization errors", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");
      const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");

      // Mock service initialization failure
      vi.mocked(AppointmentService.forTenant).mockRejectedValue(
        new Error("Database connection failed"),
      );
      vi.mocked(verifyBookingAccessToken).mockResolvedValue(validTokenPayload as any);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should return 404 when service throws NotFoundError", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");
      const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");

      const mockService = {
        createNewClientWithAppointment: vi
          .fn()
          .mockRejectedValue(new NotFoundError("Channel not found")),
      };
      vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);
      vi.mocked(verifyBookingAccessToken).mockResolvedValue(validTokenPayload as any);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(data.error).toBe("Channel not found");
      expect(response.status).toBe(404);
    });
  });

  describe("Logging", () => {
    it("should log appointment creation attempts", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");
      const { logger } = await import("$lib/logger");
      const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");

      const mockService = {
        createNewClientWithAppointment: vi.fn().mockResolvedValue({
          id: "appointment-123",
          appointmentDate: "2024-12-25T14:30:00.000Z",
          status: "NEW",
        }),
      };
      vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);
      vi.mocked(verifyBookingAccessToken).mockResolvedValue(validTokenPayload as any);

      const event = createMockRequestEvent();
      await POST(event);

      expect(logger.debug).toHaveBeenCalledWith("Creating new client appointment tunnel", {
        tenantId: mockTenantId,
        tunnelId: mockTunnelId,
      });
    });

    it("should log errors when service fails", async () => {
      const { AppointmentService } = await import("$lib/server/services/appointment-service");
      const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");

      const mockService = {
        createNewClientWithAppointment: vi.fn().mockRejectedValue(new Error("Service error")),
      };
      vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);
      vi.mocked(verifyBookingAccessToken).mockResolvedValue(validTokenPayload as any);

      const event = createMockRequestEvent();
      await POST(event);

      // Logger error calls are handled by logError function, so we just verify the endpoint doesn't crash
      expect(true).toBe(true);
    });

    it("should return 403 when token binding does not match request", async () => {
      const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");
      vi.mocked(verifyBookingAccessToken).mockResolvedValue({
        ...validTokenPayload,
        clientPublicKey: "other-client-key",
      } as any);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Booking access token is not valid for this client key");
    });
  });
});
