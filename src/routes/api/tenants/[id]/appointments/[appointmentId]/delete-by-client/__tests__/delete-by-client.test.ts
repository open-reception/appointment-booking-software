/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "../+server";
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

vi.mock("$lib/server/services/appointment-service");

const mockTenantId = "tenant-123";
const mockAppointmentId = "appointment-456";
const mockEmailHash = "email-hash-abc123";
const mockChallengeId = "challenge-789";
const mockChallengeResponse = "decrypted-challenge";

describe("DELETE /api/tenants/[id]/appointments/[appointmentId]/delete-by-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (body?: any): RequestEvent => {
    return {
      request: {
        json: vi.fn().mockResolvedValue(
          body || {
            emailHash: mockEmailHash,
            challengeId: mockChallengeId,
            challengeResponse: mockChallengeResponse,
          },
        ),
      } as any,
      params: { id: mockTenantId, appointmentId: mockAppointmentId },
    } as RequestEvent;
  };

  it("should delete appointment successfully with valid authentication", async () => {
    const { AppointmentService } = await import("$lib/server/services/appointment-service");

    const mockService = {
      deleteAppointmentByClient: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

    const event = createMockRequest();
    const response = await DELETE(event);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Appointment deleted successfully");
    expect(mockService.deleteAppointmentByClient).toHaveBeenCalledWith(
      mockAppointmentId,
      mockEmailHash,
      mockChallengeId,
      mockChallengeResponse,
    );
  });

  it("should return 422 when emailHash is missing", async () => {
    const event = createMockRequest({
      challengeId: mockChallengeId,
      challengeResponse: mockChallengeResponse,
    });

    const response = await DELETE(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should return 422 when challengeId is missing", async () => {
    const event = createMockRequest({
      emailHash: mockEmailHash,
      challengeResponse: mockChallengeResponse,
    });

    const response = await DELETE(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should return 422 when challengeResponse is missing", async () => {
    const event = createMockRequest({
      emailHash: mockEmailHash,
      challengeId: mockChallengeId,
    });

    const response = await DELETE(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should return 422 when tenant ID is missing", async () => {
    const event = {
      request: {
        json: vi.fn().mockResolvedValue({
          emailHash: mockEmailHash,
          challengeId: mockChallengeId,
          challengeResponse: mockChallengeResponse,
        }),
      } as any,
      params: { id: undefined, appointmentId: mockAppointmentId },
    } as RequestEvent;

    const response = await DELETE(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should return 422 when appointment ID is missing", async () => {
    const event = {
      request: {
        json: vi.fn().mockResolvedValue({
          emailHash: mockEmailHash,
          challengeId: mockChallengeId,
          challengeResponse: mockChallengeResponse,
        }),
      } as any,
      params: { id: mockTenantId, appointmentId: undefined },
    } as RequestEvent;

    const response = await DELETE(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should return 422 when emailHash is empty", async () => {
    const event = createMockRequest({
      emailHash: "",
      challengeId: mockChallengeId,
      challengeResponse: mockChallengeResponse,
    });

    const response = await DELETE(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBeDefined();
  });

  it("should handle NotFoundError when challenge is invalid", async () => {
    const { AppointmentService } = await import("$lib/server/services/appointment-service");
    const { NotFoundError } = await import("$lib/server/utils/errors");

    const mockService = {
      deleteAppointmentByClient: vi
        .fn()
        .mockRejectedValue(new NotFoundError("Challenge not found")),
    };
    vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

    const event = createMockRequest();
    const response = await DELETE(event);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Challenge not found");
  });

  it("should handle ValidationError when appointment doesn't belong to client", async () => {
    const { AppointmentService } = await import("$lib/server/services/appointment-service");
    const { ValidationError } = await import("$lib/server/utils/errors");

    const mockService = {
      deleteAppointmentByClient: vi
        .fn()
        .mockRejectedValue(new ValidationError("Appointment does not belong to this client")),
    };
    vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

    const event = createMockRequest();
    const response = await DELETE(event);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe("Appointment does not belong to this client");
  });

  it("should handle service errors gracefully", async () => {
    const { AppointmentService } = await import("$lib/server/services/appointment-service");

    const mockService = {
      deleteAppointmentByClient: vi.fn().mockRejectedValue(new Error("Database error")),
    };
    vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);

    const event = createMockRequest();
    const response = await DELETE(event);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
