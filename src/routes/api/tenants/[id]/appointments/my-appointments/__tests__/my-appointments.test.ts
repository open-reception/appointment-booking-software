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

  const createMockRequest = (emailHash?: string): RequestEvent => {
    const headers = new Headers();
    if (emailHash) {
      headers.set("X-Email-Hash", emailHash);
    }

    return {
      request: {
        headers,
      } as Request,
      params: { id: mockTenantId },
    } as RequestEvent;
  };

  it("should return future appointments for authenticated client", async () => {
    const { getTenantDb } = await import("$lib/server/db");
    const { AppointmentService } = await import("$lib/server/services/appointment-service");

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

    const event = createMockRequest(mockEmailHash);
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

    const event = createMockRequest(mockEmailHash);
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.appointments).toHaveLength(0);
  });

  it("should return 422 when X-Email-Hash header is missing", async () => {
    const event = createMockRequest();
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should return 422 when tenant ID is missing", async () => {
    const event = {
      request: {
        headers: new Headers({ "X-Email-Hash": mockEmailHash }),
      } as Request,
      params: { id: undefined },
    } as RequestEvent;

    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should return 422 when client tunnel is not found", async () => {
    const { getTenantDb } = await import("$lib/server/db");

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

    const event = createMockRequest(mockEmailHash);
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe("Client not found");
  });

  it("should return 422 when email hash is empty", async () => {
    const event = createMockRequest("");
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should handle database errors gracefully", async () => {
    const { getTenantDb } = await import("$lib/server/db");

    vi.mocked(getTenantDb).mockRejectedValue(new Error("Database connection failed"));

    const event = createMockRequest(mockEmailHash);
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it("should handle service errors gracefully", async () => {
    const { getTenantDb } = await import("$lib/server/db");
    const { AppointmentService } = await import("$lib/server/services/appointment-service");

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

    const event = createMockRequest(mockEmailHash);
    const response = await GET(event);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
