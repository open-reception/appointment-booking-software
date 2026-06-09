import { logger } from "$lib/logger";
import { StaffCryptoService } from "$lib/server/services/staff-crypto.service";
import { AuthenticationError, AuthorizationError } from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";
import type { RequestEvent } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../+server";

// Mock dependencies
vi.mock("$lib/logger");
vi.mock("$lib/server/services/staff-crypto.service");
vi.mock("$lib/server/utils/permissions");
vi.mock("$lib/server/openapi");

const mockCookies = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const createMockRequestEvent = (tenantId: string, locals: unknown = {}): RequestEvent =>
  ({
    params: { id: tenantId },
    request: new Request(
      `http://localhost/api/tenants/${tenantId}/appointments/staff-public-keys-by-staff`,
    ),
    url: new URL(
      `http://localhost/api/tenants/${tenantId}/appointments/staff-public-keys-by-staff`,
    ),
    route: { id: "/api/tenants/[id]/appointments/staff-public-keys-by-staff" },
    locals,
    cookies: mockCookies,
    fetch: global.fetch,
    getClientAddress: () => "127.0.0.1",
    isDataRequest: false,
    platform: undefined,
    setHeaders: vi.fn(),
    depends: vi.fn(),
    parent: vi.fn(),
  }) as unknown as RequestEvent;

describe("GET /api/tenants/[id]/appointments/staff-public-keys-by-staff", () => {
  const mockTenantId = "550e8400-e29b-41d4-a716-446655440000";
  const mockStaffId1 = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const mockStaffId2 = "f47ac10b-58cc-4372-a567-0e02b2c3d480";

  const mockStaffPublicKeys = [
    {
      userId: mockStaffId1,
      publicKey: "deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678",
      passkeyId: "key1",
    },
    {
      userId: mockStaffId2,
      publicKey: "cafebabe1234567890abcdef1234567890abcdef1234567890abcdef12345678",
      passkeyId: "key2",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logger.info).mockImplementation(() => {});
    vi.mocked(logger.warn).mockImplementation(() => {});
  });

  describe("Success Cases", () => {
    it("should return staff public keys for authenticated user with valid cookie", async () => {
      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: mockTenantId,
        },
      };

      vi.mocked(checkPermission).mockImplementationOnce(() => {});
      vi.mocked(StaffCryptoService.prototype.getStaffPublicKeys).mockResolvedValueOnce(
        mockStaffPublicKeys,
      );

      const event = createMockRequestEvent(mockTenantId, locals);
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.staffPublicKeys).toEqual(mockStaffPublicKeys);
      expect(data.staffPublicKeys).toHaveLength(2);
    });

    it("should return multiple staff public keys", async () => {
      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: mockTenantId,
        },
      };

      vi.mocked(checkPermission).mockImplementationOnce(() => {});

      const manyStaffKeys = Array.from({ length: 5 }, (_, i) => ({
        userId: `staff-${i}`,
        publicKey: `key-${i}${"a".repeat(60)}`,
        passkeyId: `passkey-${i}`,
      }));

      vi.mocked(StaffCryptoService.prototype.getStaffPublicKeys).mockResolvedValueOnce(
        manyStaffKeys,
      );

      const event = createMockRequestEvent(mockTenantId, locals);
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.staffPublicKeys).toHaveLength(5);
      expect(data.staffPublicKeys[0]).toHaveProperty("userId");
      expect(data.staffPublicKeys[0]).toHaveProperty("publicKey");
    });

    it("should call StaffCryptoService with correct tenant ID", async () => {
      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: mockTenantId,
        },
      };

      vi.mocked(checkPermission).mockImplementationOnce(() => {});

      const mockGetStaffPublicKeys = vi
        .mocked(StaffCryptoService.prototype.getStaffPublicKeys)
        .mockResolvedValueOnce(mockStaffPublicKeys);

      const event = createMockRequestEvent(mockTenantId, locals);
      await GET(event);

      expect(mockGetStaffPublicKeys).toHaveBeenCalledWith(mockTenantId);
      expect(mockGetStaffPublicKeys).toHaveBeenCalledOnce();
    });

    it("should call checkPermission with tenant ID and false flag", async () => {
      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: mockTenantId,
        },
      };

      vi.mocked(checkPermission).mockImplementationOnce(() => {});
      vi.mocked(StaffCryptoService.prototype.getStaffPublicKeys).mockResolvedValueOnce(
        mockStaffPublicKeys,
      );

      const event = createMockRequestEvent(mockTenantId, locals);
      await GET(event);

      expect(vi.mocked(checkPermission)).toHaveBeenCalledWith(locals, mockTenantId, false);
      expect(vi.mocked(checkPermission)).toHaveBeenCalledOnce();
    });
  });

  describe("Validation & Error Cases", () => {
    it("should return 422 when tenant ID is missing (ValidationError from SvelteKit)", async () => {
      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: mockTenantId,
        },
      };

      const event = createMockRequestEvent("", locals);
      const response = await GET(event);

      // ValidationError returns 422 in SvelteKit
      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    it("should return 401 when user is not authenticated", async () => {
      vi.mocked(checkPermission).mockImplementationOnce(() => {
        throw new AuthenticationError("Authentication required");
      });

      const locals = { user: null };
      const event = createMockRequestEvent(mockTenantId, locals);
      const response = await GET(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    it("should return 401 when locals are missing user", async () => {
      vi.mocked(checkPermission).mockImplementationOnce(() => {
        throw new AuthenticationError("Authentication required");
      });

      const event = createMockRequestEvent(mockTenantId, {});
      const response = await GET(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    it("should return 403 when user lacks permission for tenant", async () => {
      vi.mocked(checkPermission).mockImplementationOnce(() => {
        throw new AuthorizationError("Insufficient permissions");
      });

      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: "different-tenant-id",
        },
      };

      const event = createMockRequestEvent(mockTenantId, locals);
      const response = await GET(event);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    it("should return 500 when no staff keys are found", async () => {
      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: mockTenantId,
        },
      };

      vi.mocked(checkPermission).mockImplementationOnce(() => {});
      vi.mocked(StaffCryptoService.prototype.getStaffPublicKeys).mockResolvedValueOnce([]);

      const event = createMockRequestEvent(mockTenantId, locals);
      const response = await GET(event);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    it("should return 500 when StaffCryptoService throws an error", async () => {
      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: mockTenantId,
        },
      };

      vi.mocked(checkPermission).mockImplementationOnce(() => {});

      const serviceError = new Error("Database connection failed");
      vi.mocked(StaffCryptoService.prototype.getStaffPublicKeys).mockRejectedValueOnce(
        serviceError,
      );

      const event = createMockRequestEvent(mockTenantId, locals);
      const response = await GET(event);

      expect(response.status).toBe(500);
    });
  });

  describe("Logging", () => {
    it("should log info when successfully fetching staff keys", async () => {
      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: mockTenantId,
        },
      };

      vi.mocked(checkPermission).mockImplementationOnce(() => {});
      vi.mocked(StaffCryptoService.prototype.getStaffPublicKeys).mockResolvedValueOnce(
        mockStaffPublicKeys,
      );

      const event = createMockRequestEvent(mockTenantId, locals);
      await GET(event);

      expect(vi.mocked(logger.info)).toHaveBeenCalledWith("Fetching staff public keys", {
        tenantId: mockTenantId,
      });
      expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
        "Successfully retrieved staff public keys",
        {
          tenantId: mockTenantId,
          staffCount: 2,
        },
      );
    });

    it("should log warning when no staff keys found", async () => {
      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: mockTenantId,
        },
      };

      vi.mocked(checkPermission).mockImplementationOnce(() => {});
      vi.mocked(StaffCryptoService.prototype.getStaffPublicKeys).mockResolvedValueOnce([]);

      const event = createMockRequestEvent(mockTenantId, locals);
      await GET(event);

      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith("No staff public keys found for tenant", {
        tenantId: mockTenantId,
      });
    });
  });

  describe("Response Format", () => {
    it("should return properly formatted JSON response", async () => {
      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: mockTenantId,
        },
      };

      vi.mocked(checkPermission).mockImplementationOnce(() => {});
      vi.mocked(StaffCryptoService.prototype.getStaffPublicKeys).mockResolvedValueOnce(
        mockStaffPublicKeys,
      );

      const event = createMockRequestEvent(mockTenantId, locals);
      const response = await GET(event);

      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("staffPublicKeys");
      expect(Array.isArray(data.staffPublicKeys)).toBe(true);
    });

    it("should include complete staff key objects with userId and publicKey", async () => {
      const locals = {
        user: {
          userId: "booking-user-id",
          role: "GUEST",
          tenantId: mockTenantId,
        },
      };

      vi.mocked(checkPermission).mockImplementationOnce(() => {});
      vi.mocked(StaffCryptoService.prototype.getStaffPublicKeys).mockResolvedValueOnce(
        mockStaffPublicKeys,
      );

      const event = createMockRequestEvent(mockTenantId, locals);
      const response = await GET(event);
      const data = await response.json();

      data.staffPublicKeys.forEach(
        (key: { userId: string; publicKey: string; passkeyId: string }) => {
          expect(key).toHaveProperty("userId");
          expect(key).toHaveProperty("publicKey");
          expect(key).toHaveProperty("passkeyId");
          expect(typeof key.userId).toBe("string");
          expect(typeof key.publicKey).toBe("string");
        },
      );
    });
  });
});
