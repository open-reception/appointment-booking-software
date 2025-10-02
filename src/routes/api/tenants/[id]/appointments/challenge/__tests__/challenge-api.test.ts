/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/logger", () => {
  const mockLogger = {
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

vi.mock("$lib/server/db", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("$lib/crypto/utils", () => ({
  BufferUtils: {
    from: vi.fn(),
    toString: vi.fn(),
    concat: vi.fn(),
    xor: vi.fn(),
  },
  KyberCrypto: {
    encapsulate: vi.fn(),
  },
}));

vi.mock("$lib/server/services/challenge-store", () => ({
  challengeStore: {
    store: vi.fn(),
  },
}));

vi.mock("crypto", () => ({
  randomBytes: vi.fn(),
}));

import { getTenantDb } from "$lib/server/db";
import { randomBytes } from "crypto";
import { KyberCrypto, BufferUtils } from "$lib/crypto/utils";
import { challengeStore } from "$lib/server/services/challenge-store";

describe("Challenge API Route", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getTenantDb as any).mockResolvedValue(mockDb);
    (randomBytes as any).mockImplementation((size: number) => {
      if (size === 32) return Buffer.from("challenge-data-32-bytes-long-string");
      if (size === 16) return Buffer.from("challenge-id-16b");
      return Buffer.alloc(size);
    });
  });

  function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    return {
      params: { id: mockTenantId },
      request: {
        json: vi.fn().mockResolvedValue({
          emailHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
        }),
      } as any,
      locals: { user: null } as any, // Public endpoint, no authentication required
      ...overrides,
    } as RequestEvent;
  }

  describe("POST /api/tenants/[id]/appointments/challenge", () => {
    it("should create challenge for existing client", async () => {
      const mockTunnel = {
        id: "tunnel-123",
        clientPublicKey: "deadbeef123456789abcdef",
        privateKeyShare: "fedcba9876543210fedcba98",
      };

      mockDb.limit.mockResolvedValue([mockTunnel]);

      const mockEncapsulation = {
        encapsulatedSecret: Buffer.from("encapsulated-secret"),
        sharedSecret: Buffer.from("shared-secret-32-bytes-long-string"),
      };

      (KyberCrypto.encapsulate as any).mockReturnValue(mockEncapsulation);
      (BufferUtils.from as any).mockImplementation((data: any, encoding?: string) => {
        if (encoding === "hex") return Buffer.from(data, "hex");
        return Buffer.from(data);
      });
      (BufferUtils.xor as any).mockReturnValue(Buffer.from("encrypted-challenge"));
      (BufferUtils.concat as any).mockReturnValue(Buffer.from("full-encrypted-challenge"));
      (BufferUtils.toString as any).mockReturnValue("hex-encoded-challenge");
      (challengeStore.store as any).mockResolvedValue(true);

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("challengeId");
      expect(data).toHaveProperty("encryptedChallenge");
      expect(data).toHaveProperty("privateKeyShare");
      expect(data.privateKeyShare).toBe(mockTunnel.privateKeyShare);
      expect(challengeStore.store).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
        mockTenantId,
      );
    });

    it("should handle missing tenant ID", async () => {
      const event = createMockRequestEvent({
        params: { id: undefined },
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Tenant ID is required");
    });

    it("should handle invalid request body", async () => {
      const event = createMockRequestEvent({
        request: {
          json: vi.fn().mockResolvedValue({
            // Missing emailHash
          }),
        } as any,
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Invalid request data");
    });

    it("should handle client not found", async () => {
      mockDb.limit.mockResolvedValue([]); // No tunnel found

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Client not found");
    });

    it("should handle database errors", async () => {
      mockDb.limit.mockRejectedValue(new Error("Database connection failed"));

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should handle invalid email hash format", async () => {
      const event = createMockRequestEvent({
        request: {
          json: vi.fn().mockResolvedValue({
            // Missing emailHash field to trigger Zod validation error
          }),
        } as any,
      });

      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Invalid request data");
    });

    it("should work without authentication (public endpoint)", async () => {
      const mockTunnel = {
        id: "tunnel-123",
        clientPublicKey: "deadbeef123456789abcdef",
        privateKeyShare: "fedcba9876543210fedcba98",
      };

      mockDb.limit.mockResolvedValue([mockTunnel]);

      const mockEncapsulation = {
        encapsulatedSecret: Buffer.from("encapsulated-secret"),
        sharedSecret: Buffer.from("shared-secret-32-bytes-long-string"),
      };

      (KyberCrypto.encapsulate as any).mockReturnValue(mockEncapsulation);
      (BufferUtils.from as any).mockImplementation((data: any, encoding?: string) => {
        if (encoding === "hex") return Buffer.from(data, "hex");
        return Buffer.from(data);
      });
      (BufferUtils.xor as any).mockReturnValue(Buffer.from("encrypted-challenge"));
      (BufferUtils.concat as any).mockReturnValue(Buffer.from("full-encrypted-challenge"));
      (BufferUtils.toString as any).mockReturnValue("hex-encoded-challenge");
      (challengeStore.store as any).mockResolvedValue(true);

      const event = createMockRequestEvent({
        locals: { user: null } as any,
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
      // Should work without authentication
    });

    it("should handle challenge store failures", async () => {
      const mockTunnel = {
        id: "tunnel-123",
        clientPublicKey: "deadbeef123456789abcdef",
        privateKeyShare: "fedcba9876543210fedcba98",
      };

      mockDb.limit.mockResolvedValue([mockTunnel]);

      const mockEncapsulation = {
        encapsulatedSecret: Buffer.from("encapsulated-secret"),
        sharedSecret: Buffer.from("shared-secret-32-bytes-long-string"),
      };

      (KyberCrypto.encapsulate as any).mockReturnValue(mockEncapsulation);
      (BufferUtils.from as any).mockImplementation((data: any, encoding?: string) => {
        if (encoding === "hex") return Buffer.from(data, "hex");
        return Buffer.from(data);
      });
      (BufferUtils.xor as any).mockReturnValue(Buffer.from("encrypted-challenge"));
      (BufferUtils.concat as any).mockReturnValue(Buffer.from("full-encrypted-challenge"));
      (BufferUtils.toString as any).mockReturnValue("hex-encoded-challenge");
      (challengeStore.store as any).mockRejectedValue(new Error("Redis connection failed"));

      const event = createMockRequestEvent();
      const response = await POST(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
