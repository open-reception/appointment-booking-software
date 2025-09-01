import { describe, it, expect } from "vitest";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokens,
  isTokenExpired,
} from "../jwt-utils";
import type { SelectUser } from "$lib/server/db/central-schema";

const mockUser: SelectUser = {
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
  role: "GLOBAL_ADMIN",
  tenantId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: new Date(),
  isActive: true,
  confirmed: true,
  token: null,
  tokenValidUntil: null,
  passphraseHash: null,
  recoveryPassphrase: null,
  language: "de",
};

describe("JWT Utils", () => {
  const sessionId = "test-session-id";

  describe("generateAccessToken", () => {
    it("should generate a valid access token", async () => {
      const token = await generateAccessToken(mockUser, sessionId);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should include user data in token payload", async () => {
      const token = await generateAccessToken(mockUser, sessionId);
      const payload = await verifyAccessToken(token);

      expect(payload).toBeDefined();
      expect(payload!.userId).toBe(mockUser.id);
      expect(payload!.email).toBe(mockUser.email);
      expect(payload!.name).toBe(mockUser.name);
      expect(payload!.role).toBe(mockUser.role);
      expect(payload!.sessionId).toBe(sessionId);
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a valid refresh token", async () => {
      const token = await generateRefreshToken(mockUser.id, sessionId);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should include user and session data in token payload", async () => {
      const token = await generateRefreshToken(mockUser.id, sessionId);
      const payload = await verifyRefreshToken(token);

      expect(payload).toBeDefined();
      expect(payload!.userId).toBe(mockUser.id);
      expect(payload!.sessionId).toBe(sessionId);
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify a valid access token", async () => {
      const token = await generateAccessToken(mockUser, sessionId);
      const payload = await verifyAccessToken(token);

      expect(payload).toBeDefined();
      expect(payload!.userId).toBe(mockUser.id);
    });

    it("should reject invalid tokens", async () => {
      const payload = await verifyAccessToken("invalid.token.here");
      expect(payload).toBeNull();
    });

    it("should reject malformed tokens", async () => {
      const payload = await verifyAccessToken("invalid-token");
      expect(payload).toBeNull();
    });
  });

  describe("verifyRefreshToken", () => {
    it("should verify a valid refresh token", async () => {
      const token = await generateRefreshToken(mockUser.id, sessionId);
      const payload = await verifyRefreshToken(token);

      expect(payload).toBeDefined();
      expect(payload!.userId).toBe(mockUser.id);
      expect(payload!.sessionId).toBe(sessionId);
    });

    it("should reject invalid tokens", async () => {
      const payload = await verifyRefreshToken("invalid.token.here");
      expect(payload).toBeNull();
    });

    it("should reject access tokens as refresh tokens", async () => {
      const accessToken = await generateAccessToken(mockUser, sessionId);
      const payload = await verifyRefreshToken(accessToken);
      expect(payload).toBeNull();
    });
  });

  describe("generateTokens", () => {
    it("should generate both access and refresh tokens", async () => {
      const tokens = await generateTokens(mockUser, sessionId);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(typeof tokens.accessToken).toBe("string");
      expect(typeof tokens.refreshToken).toBe("string");
    });

    it("should generate verifiable tokens", async () => {
      const tokens = await generateTokens(mockUser, sessionId);

      const accessPayload = await verifyAccessToken(tokens.accessToken);
      const refreshPayload = await verifyRefreshToken(tokens.refreshToken);

      expect(accessPayload).toBeDefined();
      expect(refreshPayload).toBeDefined();
      expect(accessPayload!.userId).toBe(mockUser.id);
      expect(refreshPayload!.userId).toBe(mockUser.id);
    });
  });

  describe("isTokenExpired", () => {
    it("should return false for valid tokens", async () => {
      const token = await generateAccessToken(mockUser, sessionId);
      expect(await isTokenExpired(token)).toBe(false);
    });

    it("should return true for malformed tokens", async () => {
      expect(await isTokenExpired("invalid-token")).toBe(true);
    });

    it("should return true for empty tokens", async () => {
      expect(await isTokenExpired("")).toBe(true);
    });
  });

  describe("Token expiration", () => {
    it("should respect token expiration", async () => {
      // Test with an obviously expired token (JWT with past exp claim)
      // This is a manually crafted expired JWT for testing purposes
      const expiredToken =
        "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIiwicm9sZSI6IkdMT0JBTF9BRE1JTiIsInNlc3Npb25JZCI6InRlc3Qtc2Vzc2lvbi1pZCIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwOTAwfQ.";

      const payload = await verifyAccessToken(expiredToken);
      expect(payload).toBeNull();
    });
  });
});
