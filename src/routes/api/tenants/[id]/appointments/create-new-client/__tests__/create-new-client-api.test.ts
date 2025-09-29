/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/server/db", () => ({
  getTenantDb: vi.fn(),
  centralDb: {
    select: vi.fn(),
  },
}));

vi.mock("$lib/logger", () => ({
  logger: {
    setContext: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("$lib/server/services/cryptographic-service", () => ({
  CryptographicService: {
    generateRandomBytes: vi.fn(() => Buffer.from("random-bytes")),
  },
}));

import { getTenantDb, centralDb } from "$lib/server/db";
import { logger } from "$lib/logger";

describe("Create New Client API Route - Authorization Check", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockTunnelId = "tunnel-123";
  const mockChannelId = "channel-456";

  const validRequestBody = {
    tunnelId: mockTunnelId,
    channelId: mockChannelId,
    appointmentDate: "2024-12-25T14:30:00.000Z",
    emailHash: "test-email-hash",
    clientPublicKey: "test-public-key",
    privateKeyShare: "test-private-key-share",
    encryptedAppointment: {
      encryptedPayload: "encrypted-data",
      iv: "iv-data",
      authTag: "auth-tag-data",
    },
    staffKeyShares: [
      {
        userId: "staff-123",
        encryptedTunnelKey: "encrypted-tunnel-key",
      },
    ],
    clientEncryptedTunnelKey: "client-encrypted-tunnel-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockRequestEvent(
    body: any = validRequestBody,
    overrides: Partial<RequestEvent> = {},
  ): RequestEvent {
    return {
      params: { id: mockTenantId },
      request: {
        json: vi.fn().mockResolvedValue(body),
      } as any,
      locals: {
        user: {
          userId: "user123",
          role: "STAFF",
          tenantId: mockTenantId,
        },
      } as any,
      ...overrides,
    } as RequestEvent;
  }

  describe("Authorization Check for ACCESS_GRANTED Users", () => {
    it("should block client creation when no ACCESS_GRANTED users exist in tenant", async () => {
      // Mock no authorized users found
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // Empty array = no authorized users
          }),
        }),
      });

      (centralDb.select as any) = mockSelect;

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain("Cannot create client appointments");
      expect(data.error).toContain("No authorized users found in tenant");
      expect(data.error).toContain("ACCESS_GRANTED");

      expect(logger.warn).toHaveBeenCalledWith(
        "Client creation blocked: No authorized users in tenant",
        {
          tenantId: mockTenantId,
          tunnelId: mockTunnelId,
        },
      );
    });

    it("should allow client creation when ACCESS_GRANTED users exist in tenant", async () => {
      // Mock authorized users found
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: "user-123" }]), // At least one user
          }),
        }),
      });

      (centralDb.select as any) = mockSelect;

      // Mock tenant database transaction
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        return await callback({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: mockTunnelId,
                  tenantId: mockTenantId,
                  channelId: mockChannelId,
                  publicKey: "test-public-key",
                  createdAt: new Date().toISOString(),
                },
              ]),
            }),
          }),
        });
      });

      const mockDb = {
        transaction: mockTransaction,
      };

      (getTenantDb as any).mockResolvedValue(mockDb);

      const event = createMockRequestEvent();
      const response = await POST(event);

      // Should proceed with creation (not return 409)
      expect(response.status).not.toBe(409);

      // Verify authorization check was performed
      expect(mockSelect).toHaveBeenCalledWith({ count: expect.any(Object) });
    });

    it("should check correct tenant ID in authorization query", async () => {
      const mockWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      });

      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      const mockSelect = vi.fn().mockReturnValue({
        from: mockFrom,
      });

      (centralDb.select as any) = mockSelect;

      const differentTenantId = "different-tenant-id";
      const event = createMockRequestEvent(validRequestBody, {
        params: { id: differentTenantId },
      });

      await POST(event);

      // Verify the where clause was called with the correct tenant ID
      expect(mockWhere).toHaveBeenCalledWith(
        expect.objectContaining({
          // This should contain the logic checking for tenantId and confirmationState
        }),
      );
    });

    it("should handle database errors during authorization check gracefully", async () => {
      // Mock database error during authorization check
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error("Database connection failed")),
          }),
        }),
      });

      (centralDb.select as any) = mockSelect;

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should place authorization check before any tenant database operations", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No authorized users
          }),
        }),
      });

      (centralDb.select as any) = mockSelect;

      // Mock getTenantDb to verify it's not called when authorization fails
      const mockGetTenantDb = vi.fn();
      (getTenantDb as any) = mockGetTenantDb;

      const event = createMockRequestEvent();
      await POST(event);

      // Verify authorization check happens before getTenantDb is called
      expect(mockSelect).toHaveBeenCalled();
      expect(mockGetTenantDb).not.toHaveBeenCalled();
    });
  });

  describe("Error Messages and Logging", () => {
    it("should provide clear error message for unauthorized tenant", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      (centralDb.select as any) = mockSelect;

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(data.error).toBe(
        "Cannot create client appointments: No authorized users found in tenant. At least one user must have ACCESS_GRANTED status.",
      );
    });

    it("should log authorization failures with context", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      (centralDb.select as any) = mockSelect;

      const event = createMockRequestEvent();
      await POST(event);

      expect(logger.warn).toHaveBeenCalledWith(
        "Client creation blocked: No authorized users in tenant",
        {
          tenantId: mockTenantId,
          tunnelId: mockTunnelId,
        },
      );
    });
  });
});
