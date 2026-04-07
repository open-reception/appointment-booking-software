/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";
import { GET } from "../+server";

vi.mock("$lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("$lib/server/services/staff-crypto.service", () => ({
  StaffCryptoService: vi.fn(() => ({
    getStaffPublicKeys: vi.fn(),
  })),
}));

vi.mock("$lib/server/auth/booking-access-token", () => ({
  verifyBookingAccessToken: vi.fn(),
}));

import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { verifyBookingAccessToken } from "$lib/server/auth/booking-access-token";

describe("Staff Public Keys API", () => {
  const tenantId = "123e4567-e89b-12d3-a456-426614174000";

  const serviceMock = {
    getStaffPublicKeys: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (StaffCryptoService as any).mockImplementation(() => serviceMock);
  });

  function createEvent(authorization?: string): RequestEvent {
    return {
      params: { id: tenantId },
      request: {
        headers: new Headers(authorization ? { Authorization: authorization } : {}),
      } as any,
      locals: { user: null } as any,
    } as RequestEvent;
  }

  it("returns 401 when booking access token is missing", async () => {
    const response = await GET(createEvent());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Booking access token is required");
  });

  it("returns 401 for invalid booking access token", async () => {
    (verifyBookingAccessToken as any).mockResolvedValue(null);

    const response = await GET(createEvent("Bearer invalid"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid or expired booking access token");
  });

  it("returns 403 when token tenant does not match request tenant", async () => {
    (verifyBookingAccessToken as any).mockResolvedValue({
      tenantId: "different-tenant",
      emailHash: "email-hash",
      tunnelId: "tunnel-id",
      scope: "appointments:client",
    });

    const response = await GET(createEvent("Bearer valid-token"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Booking access token is not valid for this tenant");
  });

  it("returns staff public keys for valid token", async () => {
    (verifyBookingAccessToken as any).mockResolvedValue({
      tenantId,
      emailHash: "email-hash",
      tunnelId: "tunnel-id",
      scope: "appointments:client",
    });

    const staffPublicKeys = [
      {
        userId: "550e8400-e29b-41d4-a716-446655440111",
        publicKey: "base64-public-key",
      },
    ];

    serviceMock.getStaffPublicKeys.mockResolvedValue(staffPublicKeys);

    const response = await GET(createEvent("Bearer valid-token"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.staffPublicKeys).toEqual(staffPublicKeys);
    expect(serviceMock.getStaffPublicKeys).toHaveBeenCalledWith(tenantId);
  });

  it("accepts valid bootstrap-scope booking token", async () => {
    (verifyBookingAccessToken as any).mockResolvedValue({
      tenantId,
      tunnelId: "tunnel-id",
      clientPublicKey: "client-public-key",
      scope: "appointments:new-client-bootstrap",
    });

    const staffPublicKeys = [
      {
        userId: "550e8400-e29b-41d4-a716-446655440111",
        publicKey: "base64-public-key",
      },
    ];

    serviceMock.getStaffPublicKeys.mockResolvedValue(staffPublicKeys);

    const response = await GET(createEvent("Bearer bootstrap-token"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.staffPublicKeys).toEqual(staffPublicKeys);
  });
});
