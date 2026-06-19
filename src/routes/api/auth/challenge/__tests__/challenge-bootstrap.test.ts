/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Must mock env before any module that reads it at module scope
vi.mock("$env/dynamic/private", () => ({
  env: {
    JWT_SECRET: "test-jwt-secret-for-registration-bootstrap-unit-tests-minimum-32-chars",
    NODE_ENV: "test",
    MANAGEMENT_DOMAIN: "example.com",
  },
}));

vi.mock("$lib/server/auth/webauthn-service", () => ({
  WebAuthnService: {
    generateChallenge: vi.fn().mockReturnValue("challenge-base64url-value"),
    getUserPasskeys: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("$lib/server/services/user-service", () => ({
  UserService: {
    getUserByEmail: vi.fn(),
    getUserPasskeys: vi.fn(),
  },
}));

vi.mock("$lib/server/services/challenge-throttle", () => ({
  challengeThrottleService: {
    checkThrottle: vi.fn().mockResolvedValue({ allowed: true, failedAttempts: 0, retryAfterMs: 0 }),
  },
}));

import { POST } from "../+server";
import { UserService } from "$lib/server/services/user-service";
import { generateRegistrationBootstrapToken } from "$lib/server/auth/registration-bootstrap";

const USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const USER_EMAIL = "user@example.com";

const mockUser = {
  id: USER_ID,
  email: USER_EMAIL,
  name: "Test User",
  role: "STAFF" as const,
  tenantId: "t1",
};

// Helper to build a minimal SvelteKit RequestEvent
const buildEvent = (body: object, cookieMap: Record<string, string> = {}): any => ({
  request: new Request("http://localhost/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }),
  cookies: {
    get: (name: string) => cookieMap[name],
    set: vi.fn(),
    delete: vi.fn(),
  },
  url: new URL("http://localhost/api/auth/challenge"),
  locals: {},
  params: {},
  route: { id: "/api/auth/challenge" } as any,
  fetch: {} as any,
  getClientAddress: () => "127.0.0.1",
  isDataRequest: false,
  isSubRequest: false,
  platform: undefined,
  setHeaders: vi.fn(),
});

describe("POST /api/auth/challenge – registration bootstrap session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(UserService.getUserByEmail).mockRejectedValue(
      Object.assign(new Error("not found"), { name: "NotFoundError" }),
    );
    vi.mocked(UserService.getUserPasskeys).mockResolvedValue([]);
  });

  describe("login flow (user has passkeys)", () => {
    it("should not require bootstrap cookie and return 200", async () => {
      vi.mocked(UserService.getUserByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(UserService.getUserPasskeys).mockResolvedValue([{ id: "pk1" }] as any);

      const response = await POST(buildEvent({ email: USER_EMAIL }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isRegistration).toBe(false);
    });
  });

  describe("new user (does not exist yet)", () => {
    it("should not require bootstrap cookie and return 200 with isRegistration=true", async () => {
      // getUserByEmail throws NotFoundError → user does not exist
      const err = new Error("Not found");
      err.name = "NotFoundError";
      // We need to throw a proper NotFoundError from the errors module
      // Mock it as NotFoundError via the errors class
      const { NotFoundError } = await import("$lib/server/utils/errors");
      vi.mocked(UserService.getUserByEmail).mockRejectedValue(new NotFoundError("not found"));

      const response = await POST(buildEvent({ email: "newuser@example.com" }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isRegistration).toBe(true);
    });
  });

  describe("existing user without passkeys (setup-passkey flow)", () => {
    beforeEach(() => {
      vi.mocked(UserService.getUserByEmail).mockResolvedValue(mockUser as any);
      vi.mocked(UserService.getUserPasskeys).mockResolvedValue([]);
    });

    it("should return 422 when no bootstrap cookie is present", async () => {
      const response = await POST(buildEvent({ email: USER_EMAIL, userId: USER_ID }));
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/bootstrap/i);
    });

    it("should return 422 when bootstrap cookie contains wrong userId", async () => {
      const token = await generateRegistrationBootstrapToken({
        userId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
        email: USER_EMAIL,
      });

      const response = await POST(
        buildEvent(
          { email: USER_EMAIL, userId: USER_ID },
          { "webauthn-registration-bootstrap": token! },
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/bootstrap/i);
    });

    it("should return 422 when bootstrap cookie contains wrong email", async () => {
      const token = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: "other@example.com",
      });

      const response = await POST(
        buildEvent(
          { email: USER_EMAIL, userId: USER_ID },
          { "webauthn-registration-bootstrap": token! },
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/bootstrap/i);
    });

    it("should return 422 when requestUserId does not match user record", async () => {
      const token = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: USER_EMAIL,
      });

      const response = await POST(
        buildEvent(
          { email: USER_EMAIL, userId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
          { "webauthn-registration-bootstrap": token! },
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/bootstrap/i);
    });

    it("should return 422 when bootstrap cookie is a forged JWT (wrong secret)", async () => {
      const { SignJWT } = await import("jose");
      const wrongSecret = new TextEncoder().encode("wrong-secret");
      const token = await new SignJWT({
        userId: USER_ID,
        email: USER_EMAIL,
        type: "webauthn-registration-bootstrap",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(wrongSecret);

      const response = await POST(
        buildEvent(
          { email: USER_EMAIL, userId: USER_ID },
          { "webauthn-registration-bootstrap": token },
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/bootstrap/i);
    });

    it("should return 200 with valid bootstrap cookie matching user and email", async () => {
      const token = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: USER_EMAIL,
      });

      const response = await POST(
        buildEvent(
          { email: USER_EMAIL, userId: USER_ID },
          { "webauthn-registration-bootstrap": token! },
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isRegistration).toBe(true);
      expect(data.challenge).toBeDefined();
    });

    it("should accept email in non-normalised form when bootstrap token was created with same email", async () => {
      const token = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: USER_EMAIL, // stored as lowercase
      });

      // Request email in uppercase – should be normalised and still match
      const response = await POST(
        buildEvent(
          { email: "USER@EXAMPLE.COM", userId: USER_ID },
          { "webauthn-registration-bootstrap": token! },
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isRegistration).toBe(true);
    });

    it("should accept a valid bootstrap cookie without optional userId in body", async () => {
      const token = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: USER_EMAIL,
      });

      // No userId in request body → the check (!requestUserId || ...) should still pass
      const response = await POST(
        buildEvent({ email: USER_EMAIL }, { "webauthn-registration-bootstrap": token! }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isRegistration).toBe(true);
    });
  });
});
