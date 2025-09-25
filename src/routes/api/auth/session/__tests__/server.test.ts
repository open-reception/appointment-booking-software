/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { GET } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";
import { mockCookies } from "$lib/tests/const";

// Mock the logger
vi.mock("$lib/logger", () => ({
  UniversalLogger: vi.fn(() => ({
    setContext: vi.fn(() => ({
      error: vi.fn(),
      debug: vi.fn(),
    })),
  })),
}));

// Mock OpenAPI registration
vi.mock("$lib/server/openapi", () => ({
  registerOpenAPIRoute: vi.fn(),
}));

const createMockRequestEvent = (locals: any): RequestEvent =>
  ({
    locals,
    request: new Request("http://localhost/api/auth/session"),
    url: new URL("http://localhost/api/auth/session"),
    params: {},
    route: { id: "/api/auth/session" },
    cookies: mockCookies as any,
    fetch: fetch,
    getClientAddress: () => "127.0.0.1",
    isDataRequest: false,
    platform: undefined,
    setHeaders: vi.fn(),
    depends: vi.fn(),
    parent: vi.fn(),
  }) as any;

describe("/api/auth/session GET endpoint", () => {
  it("should return user session data with correct exp field when user is authenticated", async () => {
    const mockUser = {
      userId: "user-123",
      email: "test@example.com",
      name: "Test User",
      role: "STAFF",
      tenantId: "tenant-123",
      sessionId: "session-123",
      exp: 1640995200000, // timestamp in milliseconds
      isActive: true,
      confirmed: true,
    };

    const event = createMockRequestEvent({ user: mockUser });
    const response = await GET(event as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      authenticated: true,
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "STAFF",
        tenantId: "tenant-123",
      },
      expiresAt: new Date(1640995200000).toISOString(),
    });
  });

  it("should handle exp as undefined gracefully", async () => {
    const mockUser = {
      userId: "user-123",
      email: "test@example.com",
      name: "Test User",
      role: "STAFF",
      tenantId: "tenant-123",
      sessionId: "session-123",
      exp: undefined, // Test the null coalescing operator
      isActive: true,
      confirmed: true,
    };

    const event = createMockRequestEvent({ user: mockUser });
    const response = await GET(event as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      authenticated: true,
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "STAFF",
        tenantId: "tenant-123",
      },
      expiresAt: new Date(0).toISOString(), // Should default to 0
    });
  });

  it("should handle exp as null gracefully", async () => {
    const mockUser = {
      userId: "user-123",
      email: "test@example.com",
      name: "Test User",
      role: "STAFF",
      tenantId: "tenant-123",
      sessionId: "session-123",
      exp: null, // Test the null coalescing operator
      isActive: true,
      confirmed: true,
    };

    const event = createMockRequestEvent({ user: mockUser });
    const response = await GET(event as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      authenticated: true,
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "STAFF",
        tenantId: "tenant-123",
      },
      expiresAt: new Date(0).toISOString(), // Should default to 0
    });
  });

  it("should return 401 when user is not authenticated", async () => {
    const event = createMockRequestEvent({ user: null });
    const response = await GET(event as any);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({
      authenticated: false,
      message: "Not authenticated",
    });
  });

  it("should handle global admin without tenantId", async () => {
    const mockGlobalAdmin = {
      userId: "admin-123",
      email: "admin@example.com",
      name: "Global Admin",
      role: "GLOBAL_ADMIN",
      tenantId: undefined, // Global admin has no tenant
      sessionId: "session-123",
      exp: 1640995200000,
      isActive: true,
      confirmed: true,
    };

    const event = createMockRequestEvent({ user: mockGlobalAdmin });
    const response = await GET(event as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      authenticated: true,
      user: {
        id: "admin-123",
        email: "admin@example.com",
        name: "Global Admin",
        role: "GLOBAL_ADMIN",
        tenantId: undefined,
      },
      expiresAt: new Date(1640995200000).toISOString(),
    });
  });

  it("should handle exp as 0 (epoch time)", async () => {
    const mockUser = {
      userId: "user-123",
      email: "test@example.com",
      name: "Test User",
      role: "STAFF",
      tenantId: "tenant-123",
      sessionId: "session-123",
      exp: 0, // Epoch time
      isActive: true,
      confirmed: true,
    };

    const event = createMockRequestEvent({ user: mockUser });
    const response = await GET(event as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.expiresAt).toBe(new Date(0).toISOString());
  });

  it("should return 500 when an error occurs", async () => {
    // Create a mock that throws an error when accessing properties
    const problematicLocals = {
      get user() {
        throw new Error("Database connection failed");
      },
    };

    const event = createMockRequestEvent(problematicLocals);
    const response = await GET(event as any);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({
      error: "Internal server error",
    });
  });
});
