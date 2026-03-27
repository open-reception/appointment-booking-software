/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("$lib/logger")>();
  return {
    ...actual,
    logger: {
      setContext: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      })),
    },
  };
});

vi.mock("$lib/server/db", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("$lib/server/services/appointment-service");
vi.mock("$lib/server/auth/booking-access-token", () => ({
  EXISTING_CLIENT_BOOKING_SCOPE: "appointments:client",
  verifyBookingAccessToken: vi.fn(),
}));

const mockTenantId = "tenant-123";
const mockEmailHash = "email-hash-abc123";
const mockTunnelId = "tunnel-456";

const mockFutureAppointments = [
  {
    id: "appointment-1",
    appointmentDate: "2025-02-01T10:00:00.000Z",
    status: "CONFIRMED",
    channelId: "channel-1",
    encryptedPayload: "encrypted-data-1",
    iv: "iv-1",
    authTag: "auth-tag-1",
  },
  {
    id: "appointment-2",
    appointmentDate: "2025-03-15T14:30:00.000Z",
    status: "NEW",
    channelId: "channel-2",
    encryptedPayload: "encrypted-data-2",
    iv: "iv-2",
    authTag: "auth-tag-2",
  },
];

describe("GET /api/tenants/[id]/appointments/my-appointments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (emailHash?: string, authorization?: string): RequestEvent => {
    const headers = new Headers();
    if (emailHash) {
      headers.set("X-Email-Hash", emailHash);
    }
    if (authorization) {
      headers.set("Authorization", authorization);
    }

    return {
      request: {
        headers,
      } as Request,
      params: { id: mockTenantId },
    } as any;
  };

  it("should return future appointments for authenticated client", async () => {
    const { getTenantDb } = await import("$lib/server/db");
    const { AppointmentService } = await import("$lib/server/services/appointment-service");
    const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");

    vi.mocked(verifyBookingAccessToken).mockResolvedValue({
      tenantId: mockTenantId,
      tunnelId: mockTunnelId,
      emailHash: mockEmailHash,
      scope: "appointments:client",
    } as any);

    // Mock database query for tunnel
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: mockTunnelId }]),
          }),
        }),
      }),
    };
    vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

    // Mock AppointmentService
    const mockService = {
      getFutureAppointmentsByTunnelId: vi.fn().mockResolvedValue(mockFutureAppointments),
    };
    vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

    const event = createMockRequest(mockEmailHash, "Bearer valid-booking-token");
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.appointments).toHaveLength(2);
    expect(data.appointments[0]).toEqual({
      id: "appointment-1",
      appointmentDate: "2025-02-01T10:00:00.000Z",
      status: "CONFIRMED",
      channelId: "channel-1",
      encryptedData: {
        encryptedPayload: "encrypted-data-1",
        iv: "iv-1",
        authTag: "auth-tag-1",
      },
    });
    expect(mockService.getFutureAppointmentsByTunnelId).toHaveBeenCalledWith(mockTunnelId);
  });

  it("should return empty array when client has no future appointments", async () => {
    const { getTenantDb } = await import("$lib/server/db");
    const { AppointmentService } = await import("$lib/server/services/appointment-service");
    const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");

    vi.mocked(verifyBookingAccessToken).mockResolvedValue({
      tenantId: mockTenantId,
      tunnelId: mockTunnelId,
      emailHash: mockEmailHash,
      scope: "appointments:client",
    } as any);

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: mockTunnelId }]),
          }),
        }),
      }),
    };
    vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

    const mockService = {
      getFutureAppointmentsByTunnelId: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

    const event = createMockRequest(mockEmailHash, "Bearer valid-booking-token");
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.appointments).toHaveLength(0);
  });

  it("should return 401 when Authorization header is missing", async () => {
    const event = createMockRequest(mockEmailHash);
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Booking access token is required");
  });

  it("should return 422 when X-Email-Hash header is missing", async () => {
    const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");
    vi.mocked(verifyBookingAccessToken).mockResolvedValue({
      tenantId: mockTenantId,
      tunnelId: mockTunnelId,
      emailHash: mockEmailHash,
      scope: "appointments:client",
    } as any);

    const event = createMockRequest(undefined, "Bearer valid-booking-token");
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should return 422 when tenant ID is missing", async () => {
    const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");
    vi.mocked(verifyBookingAccessToken).mockResolvedValue({
      tenantId: mockTenantId,
      tunnelId: mockTunnelId,
      emailHash: mockEmailHash,
      scope: "appointments:client",
    } as any);

    const event = {
      request: {
        headers: new Headers({
          "X-Email-Hash": mockEmailHash,
          Authorization: "Bearer valid-booking-token",
        }),
      } as Request,
      params: { id: undefined },
    } as any;

    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should return 422 when client tunnel is not found", async () => {
    const { getTenantDb } = await import("$lib/server/db");
    const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");

    vi.mocked(verifyBookingAccessToken).mockResolvedValue({
      tenantId: mockTenantId,
      tunnelId: mockTunnelId,
      emailHash: mockEmailHash,
      scope: "appointments:client",
    } as any);

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No tunnel found
          }),
        }),
      }),
    };
    vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

    const event = createMockRequest(mockEmailHash, "Bearer valid-booking-token");
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe("Tenant or client not found");
  });

  it("should return 422 when email hash is empty", async () => {
    const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");
    vi.mocked(verifyBookingAccessToken).mockResolvedValue({
      tenantId: mockTenantId,
      tunnelId: mockTunnelId,
      emailHash: mockEmailHash,
      scope: "appointments:client",
    } as any);

    const event = createMockRequest("", "Bearer valid-booking-token");
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should handle database errors gracefully", async () => {
    const { getTenantDb } = await import("$lib/server/db");
    const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");

    vi.mocked(verifyBookingAccessToken).mockResolvedValue({
      tenantId: mockTenantId,
      tunnelId: mockTunnelId,
      emailHash: mockEmailHash,
      scope: "appointments:client",
    } as any);

    vi.mocked(getTenantDb).mockRejectedValue(new Error("Database connection failed"));

    const event = createMockRequest(mockEmailHash, "Bearer valid-booking-token");
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it("should handle service errors gracefully", async () => {
    const { getTenantDb } = await import("$lib/server/db");
    const { AppointmentService } = await import("$lib/server/services/appointment-service");
    const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");

    vi.mocked(verifyBookingAccessToken).mockResolvedValue({
      tenantId: mockTenantId,
      tunnelId: mockTunnelId,
      emailHash: mockEmailHash,
      scope: "appointments:client",
    } as any);

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: mockTunnelId }]),
          }),
        }),
      }),
    };
    vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

    const mockService = {
      getFutureAppointmentsByTunnelId: vi.fn().mockRejectedValue(new Error("Service error")),
    };
    vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

    const event = createMockRequest(mockEmailHash, "Bearer valid-booking-token");
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it("should return 403 when token email hash does not match header", async () => {
    const { verifyBookingAccessToken } = await import("$lib/server/auth/booking-access-token");
    vi.mocked(verifyBookingAccessToken).mockResolvedValue({
      tenantId: mockTenantId,
      tunnelId: mockTunnelId,
      emailHash: "other-email-hash",
      scope: "appointments:client",
    } as any);

    const event = createMockRequest(mockEmailHash, "Bearer valid-booking-token");
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Booking access token is not valid for this email hash");
  });
});
