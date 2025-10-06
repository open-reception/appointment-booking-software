/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/logger", () => {
  const mockLogger = {
    setContext: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  return {
    default: mockLogger,
    logger: mockLogger,
  };
});

vi.mock("$lib/server/services/staff-crypto.service", () => ({
  StaffCryptoService: vi.fn(() => ({
    getStaffCryptoForPasskey: vi.fn(),
  })),
}));

vi.mock("$lib/server/auth/webauthn-service", () => ({
  WebAuthnService: {
    getMostRecentPasskey: vi.fn(),
  },
}));

vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: vi.fn(),
}));

vi.mock("$lib/server/utils/errors", () => {
  class MockBackendError extends Error {
    constructor(
      message: string,
      public statusCode: number = 500,
    ) {
      super(message);
    }
    toJson() {
      return new Response(JSON.stringify({ error: this.message }), {
        status: this.statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return {
    BackendError: MockBackendError,
    ValidationError: class extends MockBackendError {
      constructor(message: string) {
        super(message, 400);
      }
    },
    AuthorizationError: class extends MockBackendError {
      constructor(message: string) {
        super(message, 403);
      }
    },
    NotFoundError: class extends MockBackendError {
      constructor(message: string) {
        super(message, 404);
      }
    },
    InternalError: class extends MockBackendError {
      constructor(message: string = "Internal server error") {
        super(message, 500);
      }
    },
    logError: vi.fn(() => vi.fn()),
  };
});

import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { checkPermission } from "$lib/server/utils/permissions";

describe("Staff Key Shard API Route", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockStaffId = "456e7890-e89b-12d3-a456-426614174001";
  const mockPasskeyId = "passkey-abc-123";
  const mockUserId = mockStaffId; // Same user accessing their own key shard

  const mockStaffCryptoService = {
    getStaffCryptoForPasskey: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (StaffCryptoService as any).mockImplementation(() => mockStaffCryptoService);
    (checkPermission as any).mockImplementation(() => true);
  });

  function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    return {
      params: { id: mockTenantId, staffId: mockStaffId },
      request: {} as any,
      locals: {
        user: {
          userId: mockUserId,
          sessionId: "session-123",
        },
      } as any,
      ...overrides,
    } as RequestEvent;
  }

  describe("GET /api/tenants/[id]/staff/[staffId]/key-shard", () => {
    it("should successfully return key shard for authenticated staff member", async () => {
      const mockRecentPasskey = {
        id: mockPasskeyId,
        lastUsedAt: new Date("2024-01-15T10:00:00Z"),
      };

      const mockStaffCrypto = {
        publicKey: "base64-encoded-ml-kem-768-public-key==",
        privateKeyShare: "base64-encoded-private-key-shard==",
        passkeyId: mockPasskeyId,
      };

      (WebAuthnService.getMostRecentPasskey as any).mockResolvedValue(mockRecentPasskey);
      mockStaffCryptoService.getStaffCryptoForPasskey.mockResolvedValue(mockStaffCrypto);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        publicKey: mockStaffCrypto.publicKey,
        privateKeyShare: mockStaffCrypto.privateKeyShare,
        passkeyId: mockStaffCrypto.passkeyId,
      });

      expect(WebAuthnService.getMostRecentPasskey).toHaveBeenCalledWith(mockUserId);
      expect(mockStaffCryptoService.getStaffCryptoForPasskey).toHaveBeenCalledWith(
        mockTenantId,
        mockStaffId,
        mockPasskeyId,
      );
    });

    it("should reject access when user tries to access another staff member's key shard", async () => {
      const event = createMockRequestEvent({
        locals: {
          user: {
            userId: "different-user-id",
            sessionId: "session-123",
          },
        } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("You can only access your own key shard");

      expect(WebAuthnService.getMostRecentPasskey).not.toHaveBeenCalled();
      expect(mockStaffCryptoService.getStaffCryptoForPasskey).not.toHaveBeenCalled();
    });

    it("should reject access when no user is authenticated", async () => {
      const event = createMockRequestEvent({
        locals: {
          user: null,
        } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("You can only access your own key shard");
    });

    it("should reject access when no recent passkey is found", async () => {
      (WebAuthnService.getMostRecentPasskey as any).mockResolvedValue(null);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("No valid passkey found for authenticated user");

      expect(WebAuthnService.getMostRecentPasskey).toHaveBeenCalledWith(mockUserId);
      expect(mockStaffCryptoService.getStaffCryptoForPasskey).not.toHaveBeenCalled();
    });

    it("should reject access when no staff crypto data is found for the passkey", async () => {
      const mockRecentPasskey = {
        id: mockPasskeyId,
        lastUsedAt: new Date("2024-01-15T10:00:00Z"),
      };

      (WebAuthnService.getMostRecentPasskey as any).mockResolvedValue(mockRecentPasskey);
      mockStaffCryptoService.getStaffCryptoForPasskey.mockResolvedValue(null);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Staff crypto data not found for the authenticated passkey");

      expect(WebAuthnService.getMostRecentPasskey).toHaveBeenCalledWith(mockUserId);
      expect(mockStaffCryptoService.getStaffCryptoForPasskey).toHaveBeenCalledWith(
        mockTenantId,
        mockStaffId,
        mockPasskeyId,
      );
    });

    it("should handle missing tenant ID", async () => {
      const event = createMockRequestEvent({
        params: { id: undefined, staffId: mockStaffId },
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Tenant ID and Staff ID are required");
    });

    it("should handle missing staff ID", async () => {
      const event = createMockRequestEvent({
        params: { id: mockTenantId, staffId: undefined },
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Tenant ID and Staff ID are required");
    });

    it("should handle WebAuthn service errors gracefully", async () => {
      (WebAuthnService.getMostRecentPasskey as any).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to determine passkey ID");

      expect(WebAuthnService.getMostRecentPasskey).toHaveBeenCalledWith(mockUserId);
      expect(mockStaffCryptoService.getStaffCryptoForPasskey).not.toHaveBeenCalled();
    });

    it("should handle staff crypto service errors gracefully", async () => {
      const mockRecentPasskey = {
        id: mockPasskeyId,
        lastUsedAt: new Date("2024-01-15T10:00:00Z"),
      };

      (WebAuthnService.getMostRecentPasskey as any).mockResolvedValue(mockRecentPasskey);
      mockStaffCryptoService.getStaffCryptoForPasskey.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");

      expect(WebAuthnService.getMostRecentPasskey).toHaveBeenCalledWith(mockUserId);
      expect(mockStaffCryptoService.getStaffCryptoForPasskey).toHaveBeenCalledWith(
        mockTenantId,
        mockStaffId,
        mockPasskeyId,
      );
    });

    it("should validate response structure", async () => {
      const mockRecentPasskey = {
        id: mockPasskeyId,
        lastUsedAt: new Date("2024-01-15T10:00:00Z"),
      };

      const mockStaffCrypto = {
        publicKey: "base64-encoded-ml-kem-768-public-key==",
        privateKeyShare: "base64-encoded-private-key-shard==",
        passkeyId: mockPasskeyId,
      };

      (WebAuthnService.getMostRecentPasskey as any).mockResolvedValue(mockRecentPasskey);
      mockStaffCryptoService.getStaffCryptoForPasskey.mockResolvedValue(mockStaffCrypto);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("publicKey");
      expect(data).toHaveProperty("privateKeyShare");
      expect(data).toHaveProperty("passkeyId");
      expect(typeof data.publicKey).toBe("string");
      expect(typeof data.privateKeyShare).toBe("string");
      expect(typeof data.passkeyId).toBe("string");
      expect(data.publicKey.length).toBeGreaterThan(0);
      expect(data.privateKeyShare.length).toBeGreaterThan(0);
      expect(data.passkeyId.length).toBeGreaterThan(0);
    });
  });

  describe("Security Validation", () => {
    it("should enforce strict user identity matching", async () => {
      // Test that user can only access their own key shard
      const testCases = [
        {
          requestingUserId: mockStaffId,
          targetStaffId: mockStaffId,
          shouldAllow: true,
          description: "same user accessing own key shard",
        },
        {
          requestingUserId: "different-user-id",
          targetStaffId: mockStaffId,
          shouldAllow: false,
          description: "different user trying to access staff key shard",
        },
        {
          requestingUserId: "admin-user-id",
          targetStaffId: mockStaffId,
          shouldAllow: false,
          description: "admin user trying to access staff key shard",
        },
      ];

      for (const testCase of testCases) {
        const event = createMockRequestEvent({
          params: { id: mockTenantId, staffId: testCase.targetStaffId },
          locals: {
            user: {
              userId: testCase.requestingUserId,
              sessionId: "session-123",
            },
          } as any,
        });

        const response = await GET(event);

        if (testCase.shouldAllow) {
          expect(response.status).not.toBe(403);
        } else {
          expect(response.status).toBe(403);
          const data = await response.json();
          expect(data.error).toBe("You can only access your own key shard");
        }
      }
    });

    it("should require valid passkey authentication", async () => {
      // Mock no recent passkey (security violation)
      (WebAuthnService.getMostRecentPasskey as any).mockResolvedValue(null);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("No valid passkey found for authenticated user");
    });

    it("should require matching crypto data for the authenticated passkey", async () => {
      const mockRecentPasskey = {
        id: mockPasskeyId,
        lastUsedAt: new Date("2024-01-15T10:00:00Z"),
      };

      (WebAuthnService.getMostRecentPasskey as any).mockResolvedValue(mockRecentPasskey);
      // Mock no crypto data for this passkey (security violation)
      mockStaffCryptoService.getStaffCryptoForPasskey.mockResolvedValue(null);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Staff crypto data not found for the authenticated passkey");
    });
  });
});
