/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";
import { ConflictError } from "$lib/server/utils/errors";
import { ERRORS } from "$lib/errors";
import { verifyBookingAccessToken } from "$lib/server/auth/booking-access-token";

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
  UniversalLogger: vi.fn(() => ({
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    })),
  })),
}));

vi.mock("$lib/server/email/email-service", () => ({
  sendAppointmentCreatedEmail: vi.fn(),
  sendAppointmentRequestEmail: vi.fn(),
  getChannelTitle: vi.fn(),
}));

vi.mock("$lib/server/services/tenant-admin-service", () => ({
  TenantAdminService: {
    getTenantById: vi.fn(),
  },
}));

vi.mock("$lib/server/services/notification-service", () => ({
  NotificationService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/server/auth/booking-access-token", () => ({
  EXISTING_CLIENT_BOOKING_SCOPE: "appointments:new-client-bootstrap",
  verifyBookingAccessToken: vi.fn(),
}));

import { AppointmentService } from "$lib/server/services/appointment-service";

describe("POST /api/tenants/[id]/appointments/add-to-tunnel", () => {
  const tenantId = "123e4567-e89b-12d3-a456-426614174000";

  const validBody = {
    emailHash: "test-email-hash",
    tunnelId: "tunnel-123",
    channelId: "channel-123",
    agentId: "agent-123",
    appointmentDate: "2026-01-15T14:00:00.000Z",
    appointmentTimeZone: "Europe/Berlin",
    duration: 30,
    encryptedAppointment: {
      encryptedPayload: "encrypted-payload",
      iv: "iv",
      authTag: "auth-tag",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockRequestEvent(body: unknown = validBody): RequestEvent {
    return {
      params: { id: tenantId },
      request: {
        json: vi.fn().mockResolvedValue(body),
        headers: new Headers({ Authorization: "Bearer valid-bootstrap-token" }),
      } as any,
    } as RequestEvent;
  }

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

  it("should return 409 when selected agent is already occupied", async () => {
    const mockService = {
      addAppointmentToTunnel: vi
        .fn()
        .mockRejectedValue(new ConflictError(ERRORS.APPOINTMENTS.AGENT_NOT_AVAILABLE)),
      getAppointmentById: vi.fn(),
    };

    vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockService as any);
    vi.mocked(verifyBookingAccessToken).mockResolvedValue(validTokenPayload as any);

    const event = createMockRequestEvent();
    const response = await POST(event);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe(ERRORS.APPOINTMENTS.AGENT_NOT_AVAILABLE);
    expect(mockService.addAppointmentToTunnel).toHaveBeenCalledOnce();
  });
});
