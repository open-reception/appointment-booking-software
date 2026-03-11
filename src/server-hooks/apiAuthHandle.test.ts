/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";
import { apiAuthHandle } from "./apiAuthHandle";

vi.mock("$lib/server/auth/session-service", () => ({
  SessionService: {
    validateTokenWithDB: vi.fn(),
  },
}));

vi.mock("$lib/server/auth/authorization-service", () => ({
  AuthorizationService: {
    hasRole: vi.fn(),
    hasAnyRole: vi.fn(),
  },
}));

import { SessionService } from "$lib/server/auth/session-service";

function createEvent(path: string, opts?: { bearer?: string; cookieToken?: string }): RequestEvent {
  const headers = new Headers();
  if (opts?.bearer) {
    headers.set("authorization", `Bearer ${opts.bearer}`);
  }

  return {
    url: new URL(`http://localhost${path}`),
    request: new Request(`http://localhost${path}`, { headers }),
    cookies: {
      get: vi.fn((name: string) => {
        if (name === "access_token") {
          return opts?.cookieToken ?? undefined;
        }
        return undefined;
      }),
    } as any,
    locals: {},
  } as RequestEvent;
}

describe("apiAuthHandle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips session token validation for public client appointment route with bearer booking token", async () => {
    const resolve = vi.fn(async () => new Response("ok", { status: 200 }));
    const event = createEvent(
      "/api/tenants/901d0d2a-4bf1-4755-99f2-9e1b7e11486b/appointments/staff-public-keys",
      {
        bearer: "booking-token",
      },
    );

    const response = await apiAuthHandle({ event, resolve });

    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalledOnce();
    expect(SessionService.validateTokenWithDB).not.toHaveBeenCalled();
  });

  it("still validates session token for non-public route", async () => {
    vi.mocked(SessionService.validateTokenWithDB).mockResolvedValue(null);

    const resolve = vi.fn(async () => new Response("ok", { status: 200 }));
    const event = createEvent("/api/tenants/901d0d2a-4bf1-4755-99f2-9e1b7e11486b/users", {
      bearer: "not-a-session-token",
    });

    const response = await apiAuthHandle({ event, resolve });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Invalid or expired access token");
    expect(SessionService.validateTokenWithDB).toHaveBeenCalledOnce();
    expect(resolve).not.toHaveBeenCalled();
  });
});
