import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OptimizedArgon2 } from "../hashing";
import type { Argon2Options } from "../hashing";

// Mock the logger
vi.mock("$lib/logger", () => ({
  logger: {
    setContext: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("OptimizedArgon2", () => {
  // Test data
  const testPin = "123456";
  const testClientId = "test-client-id";
  const testEmail = "test@example.com";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("deriveKeyFromPIN()", () => {
    it("should derive a key with default options", async () => {
      const result = await OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32); // Default hash length
    });

    it("should derive a key with custom options", async () => {
      const options: Argon2Options = {
        memoryCost: 32768,
        timeCost: 5,
        parallelism: 2,
        hashLength: 64,
      };

      const result = await OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId, options);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(64);
    });

    it("should produce consistent results for same inputs", async () => {
      const result1 = await OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId);
      const result2 = await OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId);

      expect(result1).toEqual(result2);
    });

    it("should produce different results for different PINs", async () => {
      const result1 = await OptimizedArgon2.deriveKeyFromPIN("123456", testClientId);
      const result2 = await OptimizedArgon2.deriveKeyFromPIN("654321", testClientId);

      expect(result1).not.toEqual(result2);
    });

    it("should produce different results for different client IDs", async () => {
      const result1 = await OptimizedArgon2.deriveKeyFromPIN(testPin, "client1");
      const result2 = await OptimizedArgon2.deriveKeyFromPIN(testPin, "client2");

      expect(result1).not.toEqual(result2);
    });

    it("should handle empty PIN", async () => {
      const result = await OptimizedArgon2.deriveKeyFromPIN("", testClientId);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it("should handle empty client ID", async () => {
      const result = await OptimizedArgon2.deriveKeyFromPIN(testPin, "");

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it("should handle unicode characters in PIN", async () => {
      const unicodePin = "тест🔐äöü";
      const result = await OptimizedArgon2.deriveKeyFromPIN(unicodePin, testClientId);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it("should handle unicode characters in client ID", async () => {
      const unicodeClientId = "клиент🆔äöü";
      const result = await OptimizedArgon2.deriveKeyFromPIN(testPin, unicodeClientId);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });
  });

  describe("createClientIdAsync()", () => {
    it("should create consistent client ID for same email", async () => {
      const result1 = await OptimizedArgon2.createClientIdAsync(testEmail);
      const result2 = await OptimizedArgon2.createClientIdAsync(testEmail);

      expect(result1).toBe(result2);
      expect(typeof result1).toBe("string");
      expect(result1.length).toBe(64); // SHA-256 hex = 64 chars
    });

    it("should create different client IDs for different emails", async () => {
      const result1 = await OptimizedArgon2.createClientIdAsync("user1@example.com");
      const result2 = await OptimizedArgon2.createClientIdAsync("user2@example.com");

      expect(result1).not.toBe(result2);
    });

    it("should handle email case insensitivity", async () => {
      const result1 = await OptimizedArgon2.createClientIdAsync("Test@Example.Com");
      const result2 = await OptimizedArgon2.createClientIdAsync("test@example.com");

      expect(result1).toBe(result2);
    });

    it("should handle empty email", async () => {
      const result = await OptimizedArgon2.createClientIdAsync("");

      expect(typeof result).toBe("string");
      expect(result.length).toBe(64);
    });

    it("should handle unicode in email", async () => {
      const unicodeEmail = "тест@example.com";
      const result = await OptimizedArgon2.createClientIdAsync(unicodeEmail);

      expect(typeof result).toBe("string");
      expect(result.length).toBe(64);
    });

    it("should produce valid hex string", async () => {
      const result = await OptimizedArgon2.createClientIdAsync(testEmail);

      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("createClientId() - Browser only", () => {
    it("should throw error in Node.js environment", async () => {
      // This test runs in Node.js environment by default
      await expect(OptimizedArgon2.createClientId(testEmail)).rejects.toThrow(
        "createClientId should be called asynchronously in Node.js environment",
      );
    });
  });

  describe("getImplementationInfo()", () => {
    it("should return implementation information", async () => {
      const info = await OptimizedArgon2.getImplementationInfo();

      expect(typeof info).toBe("string");
      expect(info.length).toBeGreaterThan(0);
      // In Node.js environment, it should try native argon2 first
      expect(info).toMatch(/(Native Node\.js argon2|@noble\/hashes)/);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle very long PIN", async () => {
      const longPin = "a".repeat(1000);
      const result = await OptimizedArgon2.deriveKeyFromPIN(longPin, testClientId);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it("should handle very long client ID", async () => {
      const longClientId = "b".repeat(1000);
      const result = await OptimizedArgon2.deriveKeyFromPIN(testPin, longClientId);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it("should handle minimum hash length", async () => {
      const options: Argon2Options = {
        hashLength: 4, // Noble hashes requires minimum 4 bytes
      };

      const result = await OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId, options);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(4);
    });

    it("should handle large hash length", async () => {
      const options: Argon2Options = {
        hashLength: 128,
      };

      const result = await OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId, options);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(128);
    });

    it("should handle minimum memory cost", async () => {
      const options: Argon2Options = {
        memoryCost: 8, // 8 KB minimum
      };

      const result = await OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId, options);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it("should handle minimum time cost", async () => {
      const options: Argon2Options = {
        timeCost: 1,
      };

      const result = await OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId, options);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });

    it("should handle different parallelism values", async () => {
      const options: Argon2Options = {
        parallelism: 4,
      };

      const result = await OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId, options);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(32);
    });
  });

  describe("Performance characteristics", () => {
    it("should complete within reasonable time with default options", async () => {
      const startTime = Date.now();

      await OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds even on slow systems
      expect(duration).toBeLessThan(5000);
    });

    it("should handle concurrent derivations", async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        OptimizedArgon2.deriveKeyFromPIN(`pin${i}`, `client${i}`),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBe(32);

        // Each result should be different
        results.slice(i + 1).forEach((otherResult) => {
          expect(result).not.toEqual(otherResult);
        });
      });
    });
  });

  describe("Consistency across implementations", () => {
    it("should produce consistent results regardless of implementation fallback", async () => {
      // Test that the fallback implementation produces consistent results
      const options: Argon2Options = {
        memoryCost: 1024, // Low memory to ensure fallback might be used
        timeCost: 1,
        parallelism: 1,
        hashLength: 32,
      };

      const results = await Promise.all([
        OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId, options),
        OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId, options),
        OptimizedArgon2.deriveKeyFromPIN(testPin, testClientId, options),
      ]);

      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });
  });
});
