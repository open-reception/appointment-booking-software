/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Must mock $env/dynamic/private before any import that reads it at module scope
vi.mock("$env/dynamic/private", () => ({
  env: {
    JWT_SECRET: "test-jwt-secret-for-registration-bootstrap-unit-tests-minimum-32-chars",
    NODE_ENV: "test",
    MANAGEMENT_DOMAIN: "example.com",
  },
}));

vi.mock("$lib/server/services/user-service", () => ({
  UserService: {
    getUserById: vi.fn(),
    getUserByEmail: vi.fn(),
    addPasskey: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock("$lib/server/auth/webauthn-service", () => ({
  WebAuthnService: {
    verifyRegistration: vi.fn(),
  },
}));

vi.mock("$lib/server/services/appointment-service", () => ({
  AppointmentService: {
    forTenant: vi.fn(),
  },
}));

import { POST } from "../[id]/+server";
import { UserService } from "$lib/server/services/user-service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { generateRegistrationBootstrapToken } from "$lib/server/auth/registration-bootstrap";

const USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const USER_EMAIL = "user@example.com";
const CHALLENGE = "challenge-base64url-value-for-testing";

const mockUser = {
  id: USER_ID,
  email: USER_EMAIL,
  name: "Test User",
  role: "STAFF" as const,
  tenantId: null,
  confirmationState: "EMAIL_CONFIRMED" as const,
};

const mockPasskeyBody = {
  email: USER_EMAIL,
  passkey: {
    id: "cred-id-123",
    attestationObject: "attestation-object-base64",
    clientDataJSON: "client-data-json-base64",
    deviceName: "Test Device",
  },
};

const buildEvent = (
  body: object,
  cookieMap: Record<string, string> = {},
  userId: string = USER_ID,
): any => ({
  request: new Request(`http://localhost/api/auth/register/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }),
  cookies: {
    get: (name: string) => cookieMap[name],
    set: vi.fn(),
    delete: vi.fn(),
  },
  url: new URL(`http://localhost/api/auth/register/${userId}`),
  locals: {},
  params: { id: userId },
  route: { id: "/api/auth/register/[id]" } as any,
  fetch: {} as any,
  getClientAddress: () => "127.0.0.1",
  isDataRequest: false,
  isSubRequest: false,
  platform: undefined,
  setHeaders: vi.fn(),
});

describe("POST /api/auth/register/[id] – registration bootstrap session", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(UserService.getUserById).mockResolvedValue(mockUser as any);
    vi.mocked(UserService.getUserByEmail).mockResolvedValue(mockUser as any);
    vi.mocked(UserService.addPasskey).mockResolvedValue(undefined as any);
    vi.mocked(UserService.updateUser).mockResolvedValue(undefined as any);
    vi.mocked(WebAuthnService.verifyRegistration).mockResolvedValue({
      credentialID: "cred-id-123",
      credentialPublicKey: "public-key-bytes",
      counter: 0,
    } as any);
    vi.mocked(AppointmentService.forTenant).mockResolvedValue({
      hasAppointments: vi.fn().mockResolvedValue(false),
    } as any);
  });

  describe("valid registration (all cookies correct)", () => {
    it("should return 201 when bootstrap cookie and registration-email cookie are valid", async () => {
      const bootstrapToken = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: USER_EMAIL,
      });

      const response = await POST(
        buildEvent(mockPasskeyBody, {
          "webauthn-registration-bootstrap": bootstrapToken!,
          "webauthn-registration-email": USER_EMAIL,
          "webauthn-challenge": CHALLENGE,
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toMatch(/passkey/i);
    });

    it("should normalise email casing when comparing", async () => {
      const bootstrapToken = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: USER_EMAIL,
      });

      vi.mocked(UserService.getUserById).mockResolvedValue({
        ...mockUser,
        email: "USER@EXAMPLE.COM",
      } as any);

      const response = await POST(
        buildEvent(
          { ...mockPasskeyBody, email: "USER@EXAMPLE.COM" },
          {
            "webauthn-registration-bootstrap": bootstrapToken!,
            "webauthn-registration-email": "USER@EXAMPLE.COM",
            "webauthn-challenge": CHALLENGE,
          },
        ),
      );

      expect(response.status).toBe(201);
    });
  });

  describe("missing or invalid bootstrap cookie", () => {
    it("should return 422 when bootstrap cookie is absent", async () => {
      const response = await POST(
        buildEvent(mockPasskeyBody, {
          "webauthn-registration-email": USER_EMAIL,
          "webauthn-challenge": CHALLENGE,
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/bootstrap/i);
    });

    it("should return 422 when bootstrap token has wrong userId", async () => {
      const bootstrapToken = await generateRegistrationBootstrapToken({
        userId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
        email: USER_EMAIL,
      });

      const response = await POST(
        buildEvent(mockPasskeyBody, {
          "webauthn-registration-bootstrap": bootstrapToken!,
          "webauthn-registration-email": USER_EMAIL,
          "webauthn-challenge": CHALLENGE,
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/bootstrap/i);
    });

    it("should return 422 when bootstrap token has wrong email", async () => {
      const bootstrapToken = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: "attacker@evil.com",
      });

      const response = await POST(
        buildEvent(mockPasskeyBody, {
          "webauthn-registration-bootstrap": bootstrapToken!,
          "webauthn-registration-email": USER_EMAIL,
          "webauthn-challenge": CHALLENGE,
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/bootstrap/i);
    });

    it("should return 422 when bootstrap cookie is a forged JWT", async () => {
      const { SignJWT } = await import("jose");
      const wrongSecret = new TextEncoder().encode("wrong-secret");
      const forgedToken = await new SignJWT({
        userId: USER_ID,
        email: USER_EMAIL,
        type: "webauthn-registration-bootstrap",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(wrongSecret);

      const response = await POST(
        buildEvent(mockPasskeyBody, {
          "webauthn-registration-bootstrap": forgedToken,
          "webauthn-registration-email": USER_EMAIL,
          "webauthn-challenge": CHALLENGE,
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/bootstrap/i);
    });

    it("should return 422 when URL userId does not match bootstrap userId", async () => {
      const bootstrapToken = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: USER_EMAIL,
      });

      const differentUserId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
      const response = await POST(
        buildEvent(
          mockPasskeyBody,
          {
            "webauthn-registration-bootstrap": bootstrapToken!,
            "webauthn-registration-email": USER_EMAIL,
            "webauthn-challenge": CHALLENGE,
          },
          differentUserId, // URL param has a different user ID
        ),
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/bootstrap/i);
    });
  });

  describe("missing registration-email cookie", () => {
    it("should return 422 when webauthn-registration-email cookie is absent", async () => {
      const bootstrapToken = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: USER_EMAIL,
      });

      const response = await POST(
        buildEvent(mockPasskeyBody, {
          "webauthn-registration-bootstrap": bootstrapToken!,
          // No webauthn-registration-email
          "webauthn-challenge": CHALLENGE,
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/challenge/i);
    });
  });

  describe("missing challenge cookie", () => {
    it("should return 422 when neither challenge cookie nor body challenge is provided", async () => {
      const bootstrapToken = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: USER_EMAIL,
      });

      const response = await POST(
        buildEvent(mockPasskeyBody, {
          "webauthn-registration-bootstrap": bootstrapToken!,
          "webauthn-registration-email": USER_EMAIL,
          // No webauthn-challenge
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toMatch(/challenge/i);
    });

    it("should use challenge from request body when challenge cookie is absent", async () => {
      const bootstrapToken = await generateRegistrationBootstrapToken({
        userId: USER_ID,
        email: USER_EMAIL,
      });

      const response = await POST(
        buildEvent(
          { ...mockPasskeyBody, challenge: CHALLENGE }, // challenge provided in body
          {
            "webauthn-registration-bootstrap": bootstrapToken!,
            "webauthn-registration-email": USER_EMAIL,
          },
        ),
      );

      expect(response.status).toBe(201);
    });
  });
});
