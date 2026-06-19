import { describe, it, expect, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({
  env: {
    JWT_SECRET: "test-jwt-secret-for-registration-bootstrap-unit-tests-minimum-32-chars",
    MANAGEMENT_DOMAIN: "example.com",
  },
}));

import { normalizeEmail } from "$lib/utils";

import {
  generateRegistrationBootstrapToken,
  verifyRegistrationBootstrapToken,
} from "../registration-bootstrap";

const VALID_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const VALID_EMAIL = "user@example.com";

describe("registration-bootstrap", () => {
  describe("normalizeEmail", () => {
    it("should lowercase and trim", () => {
      expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
    });

    it("should not change already normalised email", () => {
      expect(normalizeEmail("user@example.com")).toBe("user@example.com");
    });
  });

  describe("generateRegistrationBootstrapToken", () => {
    it("should return a JWT string", async () => {
      const token = await generateRegistrationBootstrapToken({
        userId: VALID_USER_ID,
        email: VALID_EMAIL,
      });

      expect(typeof token).toBe("string");
      expect(token!.split(".")).toHaveLength(3);
    });

    it("should normalise email before encoding", async () => {
      const token = await generateRegistrationBootstrapToken({
        userId: VALID_USER_ID,
        email: "USER@EXAMPLE.COM",
      });

      const payload = await verifyRegistrationBootstrapToken(token!);
      expect(payload!.email).toBe("user@example.com");
    });
  });

  describe("verifyRegistrationBootstrapToken", () => {
    it("should verify a valid token and return userId and email", async () => {
      const token = await generateRegistrationBootstrapToken({
        userId: VALID_USER_ID,
        email: VALID_EMAIL,
      });

      const payload = await verifyRegistrationBootstrapToken(token!);
      expect(payload).not.toBeNull();
      expect(payload!.userId).toBe(VALID_USER_ID);
      expect(payload!.email).toBe(VALID_EMAIL);
    });

    it("should return null for undefined input", async () => {
      const result = await verifyRegistrationBootstrapToken(undefined);
      expect(result).toBeNull();
    });

    it("should return null for an empty string", async () => {
      const result = await verifyRegistrationBootstrapToken("");
      expect(result).toBeNull();
    });

    it("should return null for a malformed token", async () => {
      const result = await verifyRegistrationBootstrapToken("not.a.jwt");
      expect(result).toBeNull();
    });

    it("should return null for a token signed with a different secret", async () => {
      // Manually build a token with a different secret via jose
      const { SignJWT } = await import("jose");
      const wrongSecret = new TextEncoder().encode("wrong-secret-value");
      const token = await new SignJWT({
        userId: VALID_USER_ID,
        email: VALID_EMAIL,
        type: "webauthn-registration-bootstrap",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(wrongSecret);

      const result = await verifyRegistrationBootstrapToken(token);
      expect(result).toBeNull();
    });

    it("should return null for a token with wrong type claim", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(
        "test-jwt-secret-for-registration-bootstrap-unit-tests-minimum-32-chars",
      );
      const token = await new SignJWT({
        userId: VALID_USER_ID,
        email: VALID_EMAIL,
        type: "wrong-type",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(secret);

      const result = await verifyRegistrationBootstrapToken(token);
      expect(result).toBeNull();
    });

    it("should return null for a token missing userId", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(
        "test-jwt-secret-for-registration-bootstrap-unit-tests-minimum-32-chars",
      );
      const token = await new SignJWT({
        email: VALID_EMAIL,
        type: "webauthn-registration-bootstrap",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(secret);

      const result = await verifyRegistrationBootstrapToken(token);
      expect(result).toBeNull();
    });

    it("should return null for a token missing email", async () => {
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(
        "test-jwt-secret-for-registration-bootstrap-unit-tests-minimum-32-chars",
      );
      const token = await new SignJWT({
        userId: VALID_USER_ID,
        type: "webauthn-registration-bootstrap",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(secret);

      const result = await verifyRegistrationBootstrapToken(token);
      expect(result).toBeNull();
    });

    it("should normalise email in the returned payload", async () => {
      const token = await generateRegistrationBootstrapToken({
        userId: VALID_USER_ID,
        email: "  USER@EXAMPLE.COM  ",
      });

      const payload = await verifyRegistrationBootstrapToken(token!);
      expect(payload!.email).toBe("user@example.com");
    });

    it("should distinguish tokens for different users", async () => {
      const tokenA = await generateRegistrationBootstrapToken({
        userId: VALID_USER_ID,
        email: VALID_EMAIL,
      });
      const tokenB = await generateRegistrationBootstrapToken({
        userId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        email: "other@example.com",
      });

      const payloadA = await verifyRegistrationBootstrapToken(tokenA!);
      const payloadB = await verifyRegistrationBootstrapToken(tokenB!);

      expect(payloadA!.userId).not.toBe(payloadB!.userId);
      expect(payloadA!.email).not.toBe(payloadB!.email);
    });
  });
});
