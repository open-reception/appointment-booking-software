/**
 * Optimized Argon2 Implementation
 *
 * Uses native Node.js argon2 for maximum performance
 * Falls back to argon2-browser WASM in browsers
 * Final fallback to @noble/hashes if neither available
 */

import type { CryptoBuffer } from "./utils";
import { BufferUtils } from "./utils";
import { logger } from "$lib/logger";

/**
 * Configuration options for Argon2 hashing
 */
export interface Argon2Options {
  /** Memory cost parameter (default: 65536) */
  memoryCost?: number;
  /** Time cost parameter (default: 10) */
  timeCost?: number;
  /** Parallelism parameter (default: 1) */
  parallelism?: number;
  /** Hash output length in bytes (default: 32) */
  hashLength?: number;
}

/**
 * Optimized Argon2 implementation with cross-platform support
 * Uses native Node.js argon2 for maximum performance in server environments
 * Falls back to argon2-browser WASM in browsers
 * Final fallback to @noble/hashes if neither is available
 */
export class OptimizedArgon2 {
  /**
   * Derives a cryptographic key from a PIN and client ID using Argon2
   * @param pin - The PIN to hash
   * @param clientId - The client identifier used as salt material
   * @param options - Optional Argon2 parameters
   * @returns Promise resolving to the derived key
   */
  static async deriveKeyFromPIN(
    pin: string,
    clientId: string,
    options: Argon2Options = {},
  ): Promise<CryptoBuffer> {
    const defaultOptions = {
      memoryCost: 65536,
      timeCost: 10,
      parallelism: 1,
      hashLength: 32,
    };

    const opts = { ...defaultOptions, ...options };

    if (typeof window !== "undefined") {
      return await this.#deriveKeyBrowser(pin, clientId, opts);
    } else {
      return await this.#deriveKeyNode(pin, clientId, opts);
    }
  }

  /**
   * Node.js-specific key derivation using native argon2 or fallback
   * @param pin - The PIN to hash
   * @param clientId - The client identifier
   * @param options - Complete Argon2 options
   * @returns Promise resolving to the derived key
   * @private
   */
  static async #deriveKeyNode(
    pin: string,
    clientId: string,
    options: Required<Argon2Options>,
  ): Promise<CryptoBuffer> {
    try {
      const crypto = await import("crypto");
      const salt = crypto.createHash("sha256").update(clientId).digest();

      try {
        const argon2 = await import("argon2");
        const hash = await argon2.hash(pin, {
          type: argon2.argon2id,
          memoryCost: options.memoryCost,
          timeCost: options.timeCost,
          parallelism: options.parallelism,
          salt: salt,
          raw: true,
          hashLength: options.hashLength,
        });
        return new Uint8Array(hash);
      } catch {
        logger.setContext("Hashing");
        logger.warn("Native argon2 unavailable, falling back to @noble/hashes");
        return await this.#deriveKeyFallback(pin, salt, options);
      }
    } catch (error) {
      throw new Error(`Failed to derive key in Node.js: ${error}`);
    }
  }

  /**
   * Browser-specific key derivation using argon2-browser WASM or fallback
   * @param pin - The PIN to hash
   * @param clientId - The client identifier
   * @param options - Complete Argon2 options
   * @returns Promise resolving to the derived key
   * @private
   */
  static async #deriveKeyBrowser(
    pin: string,
    clientId: string,
    options: Required<Argon2Options>,
  ): Promise<CryptoBuffer> {
    try {
      // Create salt from client ID using Web Crypto API
      const encoder = new TextEncoder();
      const saltData = await crypto.subtle.digest("SHA-256", encoder.encode(clientId));
      const salt = new Uint8Array(saltData);

      // Try to use argon2-browser WASM (from static files)
      try {
        logger.setContext("Hashing");
        logger.debug("🔍 Checking for argon2-browser from static files...");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const argon2 = (window as any).argon2;

        if (argon2) {
          logger.debug("✅ argon2-browser found from static files");

          const result = await argon2.hash({
            pass: pin,
            salt: Array.from(salt),
            type: argon2.ArgonType.Argon2id,
            mem: options.memoryCost,
            time: options.timeCost,
            parallelism: options.parallelism,
            hashLen: options.hashLength,
          });

          logger.debug("✅ Argon2 WASM hash successful");
          return new Uint8Array(result.hash);
        } else {
          logger.warn("❌ argon2-browser not available on window");
          throw new Error("argon2-browser not available");
        }
      } catch (error) {
        logger.warn(
          "❌ argon2-browser static files unavailable, falling back to @noble/hashes:",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          error as any,
        );
        return await this.#deriveKeyFallback(pin, salt, options);
      }
    } catch (error) {
      throw new Error(`Failed to derive key in browser: ${error}`);
    }
  }

  /**
   * Fallback key derivation using @noble/hashes
   * @param pin - The PIN to hash
   * @param salt - The salt for hashing
   * @param options - Complete Argon2 options
   * @returns Promise resolving to the derived key
   * @private
   */
  static async #deriveKeyFallback(
    pin: string,
    salt: CryptoBuffer,
    options: Required<Argon2Options>,
  ): Promise<CryptoBuffer> {
    const { argon2id } = await import("@noble/hashes/argon2");

    const result = argon2id(BufferUtils.from(pin), new Uint8Array(salt), {
      m: options.memoryCost,
      t: options.timeCost,
      p: options.parallelism,
      dkLen: options.hashLength,
    });

    return result;
  }

  /**
   * Creates a client ID from an email address (browser-only)
   * @param email - The email address to hash
   * @returns Promise resolving to hex-encoded client ID
   * @throws Error in Node.js environment
   */
  static async createClientId(email: string): Promise<string> {
    if (typeof window !== "undefined") {
      // Browser environment - use Web Crypto API
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(email.toLowerCase()),
      );
      return BufferUtils.toString(new Uint8Array(hash), "hex");
    } else {
      // Node.js environment - this will be handled at runtime
      throw new Error("createClientId should be called asynchronously in Node.js environment");
    }
  }

  /**
   * Creates a client ID from an email address (cross-platform)
   * @param email - The email address to hash
   * @returns Promise resolving to hex-encoded client ID
   */
  static async createClientIdAsync(email: string): Promise<string> {
    if (typeof window !== "undefined") {
      // Browser environment
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(email.toLowerCase()),
      );
      return BufferUtils.toString(new Uint8Array(hash), "hex");
    } else {
      // Node.js environment
      const crypto = await import("crypto");
      return crypto.createHash("sha256").update(email.toLowerCase()).digest("hex");
    }
  }

  /**
   * Gets information about the current Argon2 implementation being used
   * @returns Promise resolving to implementation description
   */
  static async getImplementationInfo(): Promise<string> {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).argon2) {
        return "argon2-browser WASM (static files)";
      }
      return "@noble/hashes (JavaScript fallback)";
    } else {
      try {
        await import("argon2");
        return "Native Node.js argon2 (C++ addon)";
      } catch {
        return "@noble/hashes (JavaScript fallback)";
      }
    }
  }
}
