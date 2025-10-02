/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionService } from "../session-service";
import * as jwtUtils from "../jwt-utils";

// Mock dependencies
vi.mock("$lib/server/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
  centralDb: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("../jwt-utils");

const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
  role: "STAFF" as const,
  tenantId: "tenant-123",
  isActive: true,
  confirmationState: "ACCESS_GRANTED" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
};

const mockSession = {
  id: "session-id",
  userId: "test-user-id",
  sessionToken: "session-token",
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  lastUsedAt: new Date(),
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("SessionService.validateTokenWithDB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return user, sessionId and exp for valid token", async () => {
    const { db } = await import("$lib/server/db");

    // Mock JWT verification
    const mockTokenData = {
      sessionId: "session-id",
      userId: "test-user-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    vi.mocked(jwtUtils.verifyAccessToken).mockResolvedValue(mockTokenData);

    // Mock successful database query
    const mockQuery = vi.fn().mockResolvedValue([
      {
        user: mockUser,
        user_session: mockSession,
      },
    ]);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: mockQuery,
          }),
        }),
      }),
    } as any);

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const result = await SessionService.validateTokenWithDB("valid-token");

    expect(result).toEqual({
      user: mockUser,
      sessionId: "session-id",
      exp: mockSession.expiresAt,
    });
    expect(jwtUtils.verifyAccessToken).toHaveBeenCalledWith("valid-token");
  });

  it("should return null for invalid JWT token", async () => {
    vi.mocked(jwtUtils.verifyAccessToken).mockResolvedValue(null);

    const result = await SessionService.validateTokenWithDB("invalid-token");

    expect(result).toBeNull();
    expect(jwtUtils.verifyAccessToken).toHaveBeenCalledWith("invalid-token");
  });

  it("should return null for non-existent session", async () => {
    const { db } = await import("$lib/server/db");

    const mockTokenData = {
      sessionId: "non-existent-session",
      userId: "test-user-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    vi.mocked(jwtUtils.verifyAccessToken).mockResolvedValue(mockTokenData);

    // Mock empty database result
    const mockQuery = vi.fn().mockResolvedValue([]);
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: mockQuery,
          }),
        }),
      }),
    } as any);

    const result = await SessionService.validateTokenWithDB("valid-token");

    expect(result).toBeNull();
  });

  it("should return null for inactive user", async () => {
    const { db } = await import("$lib/server/db");

    const mockTokenData = {
      sessionId: "session-id",
      userId: "test-user-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    vi.mocked(jwtUtils.verifyAccessToken).mockResolvedValue(mockTokenData);

    const inactiveUser = {
      ...mockUser,
      isActive: false,
    };

    const mockQuery = vi.fn().mockResolvedValue([
      {
        user: inactiveUser,
        user_session: mockSession,
      },
    ]);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: mockQuery,
          }),
        }),
      }),
    } as any);

    const result = await SessionService.validateTokenWithDB("valid-token");

    expect(result).toBeNull();
  });

  it("should return null for unconfirmed user", async () => {
    const { db } = await import("$lib/server/db");

    const mockTokenData = {
      sessionId: "session-id",
      userId: "test-user-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    vi.mocked(jwtUtils.verifyAccessToken).mockResolvedValue(mockTokenData);

    const unconfirmedUser = {
      ...mockUser,
      confirmationState: "PENDING_CONFIRMATION" as const,
    };

    const mockQuery = vi.fn().mockResolvedValue([
      {
        user: unconfirmedUser,
        user_session: mockSession,
      },
    ]);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: mockQuery,
          }),
        }),
      }),
    } as any);

    const result = await SessionService.validateTokenWithDB("valid-token");

    expect(result).toBeNull();
  });

  it("should return null and handle errors gracefully", async () => {
    vi.mocked(jwtUtils.verifyAccessToken).mockRejectedValue(new Error("JWT error"));

    const result = await SessionService.validateTokenWithDB("token");

    expect(result).toBeNull();
  });
});
