/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";
import { POST } from "../+server";

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
    store: vi.fn(),
  },
}));

vi.mock("$lib/server/services/challenge-throttle", () => ({
  challengeThrottleService: {
    checkThrottle: vi.fn(),
  },
}));

import { challengeStore } from "$lib/server/services/challenge-store";
import { challengeThrottleService } from "$lib/server/services/challenge-throttle";

describe("Bootstrap Challenge API", () => {
  const tenantId = "123e4567-e89b-12d3-a456-426614174000";
  const validBody = {
    tunnelId: "550e8400-e29b-41d4-a716-446655440000",
    clientPublicKey: "client-public-key",
    emailHash: "email-hash",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(challengeThrottleService.checkThrottle).mockResolvedValue({
      allowed: true,
      failedAttempts: 0,
      retryAfterMs: 1500,
    });
  });

  function createEvent(body: unknown = validBody): RequestEvent {
    return {
      params: { id: tenantId },
      request: {
        json: vi.fn().mockResolvedValue(body),
      } as any,
    } as RequestEvent;
  }

  it("returns bootstrap challenge when request is valid", async () => {
    const response = await POST(createEvent());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.challengeId).toBeTypeOf("string");
    expect(data.nonce).toBeTypeOf("string");
    expect(data.difficulty).toBe(4);
    expect(challengeStore.store).toHaveBeenCalledOnce();
  });

  it("returns 429 when throttled", async () => {
    vi.mocked(challengeThrottleService.checkThrottle).mockResolvedValue({
      allowed: false,
      failedAttempts: 0,
      retryAfterMs: 15000,
    });

    const response = await POST(createEvent());
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("Too many bootstrap attempts. Please try again later.");
  });
});
