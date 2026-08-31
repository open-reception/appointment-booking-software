/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";

vi.mock("$lib/server/services/user-service", () => ({
  UserService: {
    updateUser: vi.fn(),
  },
}));

vi.mock("$lib/server/openapi", () => ({
  registerOpenAPIRoute: vi.fn(),
}));

vi.mock("$lib/logger", () => ({
  logger: {
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

import { PUT } from "./+server";
import { UserService } from "$lib/server/services/user-service";

const mockUser = {
  id: "user-123",
  name: "Old Name",
  language: "en",
};

const createRequestEvent = (body: any, user = mockUser): RequestEvent =>
  ({
    request: {
      json: () => Promise.resolve(body),
    } as any,
    locals: {
      user,
    },
  }) as RequestEvent;

describe("/api/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the authenticated user's account and returns the new values", async () => {
    const updatedUser = { ...mockUser, name: "New Name", language: "de" };
    vi.mocked(UserService.updateUser).mockResolvedValue(updatedUser as any);

    const event = createRequestEvent({ name: "New Name", language: "de" });
    const response = await PUT(event);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ name: "New Name", language: "de" });
    expect(UserService.updateUser).toHaveBeenCalledWith(mockUser.id, {
      name: "New Name",
      language: "de",
    });
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const event = createRequestEvent({ name: "New Name" }, null as any);
    const response = await PUT(event);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(UserService.updateUser).not.toHaveBeenCalled();
  });

  it("returns 422 when the request body is invalid", async () => {
    const event = createRequestEvent({ name: "X", language: "fr" });

    const response = await PUT(event);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("Invalid request data");
    expect(UserService.updateUser).not.toHaveBeenCalled();
  });

  it("returns 500 when an unexpected error is thrown by the update service", async () => {
    vi.mocked(UserService.updateUser).mockRejectedValue(new Error("database outage"));

    const event = createRequestEvent({ name: "New Name" });
    const response = await PUT(event);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Internal server error");
  });
});
