import { describe, expect, it } from "vitest";
import {
  generateBookingAccessToken,
  verifyBookingAccessToken,
} from "$lib/server/auth/booking-access-token";

describe("booking-access-token", () => {
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
  });

  it("rejects malformed token", async () => {
    const payload = await verifyBookingAccessToken("invalid.token");
    expect(payload).toBeNull();
  });
});
