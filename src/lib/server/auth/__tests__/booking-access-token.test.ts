import { randomUUID } from "node:crypto";
import { env } from "$env/dynamic/private";
import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("$lib/server/services/booking-access-token-store", () => ({
  bookingAccessTokenStore: {
    store: vi.fn(),
    isActive: vi.fn(),
    consume: vi.fn(),
  },
}));

import {
  consumeBookingAccessToken,
  generateBookingAccessToken,
  generateNewClientBootstrapToken,
  verifyBookingAccessToken,
} from "$lib/server/auth/booking-access-token";
import { bookingAccessTokenStore } from "$lib/server/services/booking-access-token-store";

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

async function signTestToken(payload: {
  tenantId: string;
  tunnelId: string;
  scope: "appointments:client" | "appointments:new-client-bootstrap";
  emailHash?: string;
  clientPublicKey?: string;
  jti?: string;
}): Promise<string> {
  return await new SignJWT({
    tenantId: payload.tenantId,
    tunnelId: payload.tunnelId,
    scope: payload.scope,
    emailHash: payload.emailHash,
    clientPublicKey: payload.clientPublicKey,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(payload.jti ?? randomUUID())
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(JWT_SECRET);
}

describe("booking-access-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bookingAccessTokenStore.isActive).mockResolvedValue(true);
    vi.mocked(bookingAccessTokenStore.consume).mockResolvedValue(true);
  });

  it("generates and verifies a valid booking access token", async () => {
    const token = await generateBookingAccessToken({
      tenantId: "123e4567-e89b-12d3-a456-426614174000",
      emailHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
      tunnelId: "550e8400-e29b-41d4-a716-446655440000",
    });

    const payload = await verifyBookingAccessToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.tenantId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(payload?.tunnelId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(payload?.scope).toBe("appointments:client");
    expect(payload?.jti).toBeTypeOf("string");
    expect(bookingAccessTokenStore.store).toHaveBeenCalledOnce();
  });

  it("rejects malformed token", async () => {
    const payload = await verifyBookingAccessToken("invalid.token");
    expect(payload).toBeNull();
  });

  it("generates and verifies a valid bootstrap booking access token", async () => {
    const token = await generateNewClientBootstrapToken({
      tenantId: "123e4567-e89b-12d3-a456-426614174000",
      tunnelId: "550e8400-e29b-41d4-a716-446655440000",
      clientPublicKey: "bootstrap-client-public-key",
      emailHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    });

    const payload = await verifyBookingAccessToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.tenantId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(payload?.tunnelId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(payload?.clientPublicKey).toBe("bootstrap-client-public-key");
    expect(payload?.scope).toBe("appointments:new-client-bootstrap");
  });

  it("rejects existing-client token without emailHash", async () => {
    const token = await signTestToken({
      tenantId: "123e4567-e89b-12d3-a456-426614174000",
      tunnelId: "550e8400-e29b-41d4-a716-446655440000",
      scope: "appointments:client",
    });

    const payload = await verifyBookingAccessToken(token);
    expect(payload).toBeNull();
  });

  it("rejects bootstrap token without clientPublicKey", async () => {
    const token = await signTestToken({
      tenantId: "123e4567-e89b-12d3-a456-426614174000",
      tunnelId: "550e8400-e29b-41d4-a716-446655440000",
      scope: "appointments:new-client-bootstrap",
      emailHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    });

    const payload = await verifyBookingAccessToken(token);
    expect(payload).toBeNull();
  });

  it("rejects token that is not active in token store", async () => {
    vi.mocked(bookingAccessTokenStore.isActive).mockResolvedValue(false);

    const token = await generateBookingAccessToken({
      tenantId: "123e4567-e89b-12d3-a456-426614174000",
      emailHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
      tunnelId: "550e8400-e29b-41d4-a716-446655440000",
    });

    const payload = await verifyBookingAccessToken(token);
    expect(payload).toBeNull();
  });

  it("consumes token when requested", async () => {
    const token = await generateNewClientBootstrapToken({
      tenantId: "123e4567-e89b-12d3-a456-426614174000",
      tunnelId: "550e8400-e29b-41d4-a716-446655440000",
      clientPublicKey: "bootstrap-client-public-key",
    });

    const payload = await verifyBookingAccessToken(token);
    expect(payload).not.toBeNull();

    if (payload) {
      await consumeBookingAccessToken(payload);
    }

    expect(bookingAccessTokenStore.consume).toHaveBeenCalledOnce();
  });
});
