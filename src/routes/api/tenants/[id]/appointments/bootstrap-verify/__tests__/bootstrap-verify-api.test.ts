/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";
import { POST } from "../+server";
import { createBootstrapPowDigest } from "$lib/server/services/bootstrap-challenge";

vi.mock("$lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("$lib/server/services/challenge-store", () => ({
  challengeStore: {
    consume: vi.fn(),
  },
}));

vi.mock("$lib/server/services/challenge-throttle", () => ({
  challengeThrottleService: {
    recordFailedAttempt: vi.fn(),
    clearThrottle: vi.fn(),
  },
}));

vi.mock("$lib/server/auth/booking-access-token", () => ({
  generateNewClientBootstrapToken: vi.fn(),
}));

import { challengeStore } from "$lib/server/services/challenge-store";
import { challengeThrottleService } from "$lib/server/services/challenge-throttle";
import { generateNewClientBootstrapToken } from "$lib/server/auth/booking-access-token";

describe("Bootstrap Verify API", () => {
  const tenantId = "123e4567-e89b-12d3-a456-426614174000";
  const nonce = "bootstrap-nonce";
  const tunnelId = "550e8400-e29b-41d4-a716-446655440000";
  const clientPublicKey = "client-public-key";
  const emailHash = "email-hash";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateNewClientBootstrapToken).mockResolvedValue("bootstrap-token");
  });

  function createEvent(counter: number): RequestEvent {
    return {
      params: { id: tenantId },
      request: {
        json: vi.fn().mockResolvedValue({
          challengeId: "challenge-id",
          tunnelId,
          clientPublicKey,
          counter,
          emailHash,
        }),
      } as any,
    } as RequestEvent;
  }

  async function findValidCounter(): Promise<number> {
    for (let counter = 0; ; counter += 1) {
      const digest = createBootstrapPowDigest({
        nonce,
        tunnelId,
        clientPublicKey,
        counter,
      });

      if (digest.startsWith("0000")) {
        return counter;
      }
    }
  }

  it("returns bootstrap token for valid proof of work", async () => {
    vi.mocked(challengeStore.consume).mockResolvedValue({
      challenge: nonce,
      emailHash: "fdb1dce4daaadf27027857ba4b1947e6260fa7d8d40b975639096d5f04f0a96c",
    } as any);

    const validCounter = await findValidCounter();
    const { createBootstrapBinding } = await import("$lib/server/services/bootstrap-challenge");
    vi.mocked(challengeStore.consume).mockResolvedValue({
      challenge: nonce,
      emailHash: createBootstrapBinding({ tenantId, tunnelId, clientPublicKey, emailHash }),
    } as any);

    const response = await POST(createEvent(validCounter));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.bookingAccessToken).toBe("bootstrap-token");
    expect(challengeThrottleService.clearThrottle).toHaveBeenCalledOnce();
  });

  it("returns 422 for invalid proof of work", async () => {
    const { createBootstrapBinding } = await import("$lib/server/services/bootstrap-challenge");
    vi.mocked(challengeStore.consume).mockResolvedValue({
      challenge: nonce,
      emailHash: createBootstrapBinding({ tenantId, tunnelId, clientPublicKey, emailHash }),
    } as any);

    const response = await POST(createEvent(0));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe("Invalid bootstrap proof of work");
    expect(challengeThrottleService.recordFailedAttempt).toHaveBeenCalledOnce();
  });

  it("returns 404 when challenge is missing or expired", async () => {
    vi.mocked(challengeStore.consume).mockResolvedValue(null);

    const response = await POST(createEvent(0));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Bootstrap challenge not found or expired");
  });

  it("returns 422 when challenge binding does not match", async () => {
    vi.mocked(challengeStore.consume).mockResolvedValue({
      challenge: nonce,
      emailHash: "other-binding",
    } as any);

    const response = await POST(createEvent(0));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe("Invalid bootstrap challenge binding");
    expect(challengeThrottleService.recordFailedAttempt).toHaveBeenCalledOnce();
  });
});
