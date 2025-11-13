import { ml_kem768 } from "@noble/post-quantum/ml-kem";
import { randomBytes } from "@noble/hashes/utils";

/**
 * Type alias for cryptographic buffer operations
 */
export type CryptoBuffer = Uint8Array;

/**
 * Utility class for buffer operations and conversions
 */
export class BufferUtils {
  /**
   * Converts various data types to CryptoBuffer
   * @param data - The data to convert (string, number array, Uint8Array, or ArrayBuffer)
   * @param encoding - The encoding to use for string conversion ('hex' or 'utf8')
   * @returns A CryptoBuffer representation of the input data
   */
  static from(
    data: string | number[] | Uint8Array | ArrayBuffer,
    encoding?: "hex" | "utf8",
  ): CryptoBuffer {
    if (typeof data === "string") {
      if (encoding === "hex") {
        return new Uint8Array(data.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);
      }
      return new TextEncoder().encode(data);
    }
    if (Array.isArray(data)) {
      return new Uint8Array(data);
    }
    return new Uint8Array(data);
  }

  /**
   * Converts a CryptoBuffer to string
   * @param buffer - The buffer to convert
   * @param encoding - The encoding to use ('hex' or 'utf8', defaults to 'utf8')
   * @returns String representation of the buffer
   */
  static toString(buffer: CryptoBuffer, encoding: "hex" | "utf8" = "utf8"): string {
    if (encoding === "hex") {
      return Array.from(buffer)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    return new TextDecoder().decode(buffer);
  }

  /**
   * Concatenates multiple CryptoBuffers into a single buffer
   * @param buffers - Array of buffers to concatenate
   * @returns A single CryptoBuffer containing all input buffers
   */
  static concat(buffers: CryptoBuffer[]): CryptoBuffer {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }
    return result;
  }

  /**
   * Generates cryptographically secure random bytes
   * @param length - The number of random bytes to generate
   * @returns A CryptoBuffer containing random bytes
   */
  static randomBytes(length: number): CryptoBuffer {
    return randomBytes(length);
  }

  /**
   * Performs XOR operation on two CryptoBuffers
   * @param a - First buffer
   * @param b - Second buffer
   * @returns XOR result as CryptoBuffer
   */
  static xor(a: CryptoBuffer, b: CryptoBuffer): CryptoBuffer {
    const result = new Uint8Array(Math.max(a.length, b.length));
    for (let i = 0; i < result.length; i++) {
      result[i] = (a[i] || 0) ^ (b[i] || 0);
    }
    return result;
  }

  /**
   * Compares two CryptoBuffers for equality
   * @param a - First buffer
   * @param b - Second buffer
   * @returns True if buffers are equal, false otherwise
   */
  static equals(a: CryptoBuffer, b: CryptoBuffer): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

/**
 * Interface for Kyber (ML-KEM-768) key pairs
 */
export interface KyberKeyPair {
  /** The public key for encryption */
  publicKey: CryptoBuffer;
  /** The private key for decryption */
  privateKey: CryptoBuffer;
}

/**
 * Post-quantum cryptography implementation using ML-KEM-768 (Kyber)
 * Provides key generation, encapsulation, and decapsulation
 */
export class KyberCrypto {
  /**
   * Generates a new Kyber key pair
   * @returns A new KyberKeyPair containing public and private keys
   */
  static generateKeyPair(): KyberKeyPair {
    const keys = ml_kem768.keygen();
    return {
      publicKey: new Uint8Array(keys.publicKey),
      privateKey: new Uint8Array(keys.secretKey),
    };
  }

  /**
   * Encapsulates a shared secret using the recipient's public key
   * @param publicKey - The recipient's public key
   * @returns Object containing the shared secret and encapsulated secret
   */
  static encapsulate(publicKey: CryptoBuffer): {
    sharedSecret: CryptoBuffer;
    encapsulatedSecret: CryptoBuffer;
  } {
    const result = ml_kem768.encapsulate(publicKey);
    return {
      sharedSecret: new Uint8Array(result.sharedSecret),
      encapsulatedSecret: new Uint8Array(result.cipherText),
    };
  }

  /**
   * Decapsulates a shared secret using the private key
   * @param privateKey - The private key for decapsulation
   * @param encapsulatedSecret - The encapsulated secret from the sender
   * @returns The shared secret
   */
  static decapsulate(privateKey: CryptoBuffer, encapsulatedSecret: CryptoBuffer): CryptoBuffer {
    return new Uint8Array(ml_kem768.decapsulate(encapsulatedSecret, privateKey));
  }
}

/**
 * AES-GCM encryption utilities with cross-platform support
 * Uses Web Crypto API in browsers and Node.js crypto in server environments
 */
export class AESCrypto {
  /**
   * Generates a random 256-bit AES session key
   * @returns A 32-byte CryptoBuffer for use as AES-256 key
   */
  static generateSessionKey(): CryptoBuffer {
    return BufferUtils.randomBytes(32);
  }

  /**
   * Encrypts data using AES-256-GCM
   * @param data - The plaintext string to encrypt
   * @param key - The 32-byte AES key
   * @returns Promise resolving to encrypted data, IV, and authentication tag
   */
  static async encrypt(
    data: string,
    key: CryptoBuffer,
  ): Promise<{ encrypted: CryptoBuffer; iv: CryptoBuffer; tag: CryptoBuffer }> {
    const iv = BufferUtils.randomBytes(16);

    // Use Web Crypto API if available (browser), otherwise fall back to Node.js
    if (typeof crypto !== "undefined" && crypto.subtle) {
      // Browser implementation using Web Crypto API
      // Ensure native Uint8Array with ArrayBuffer for Web Crypto API compatibility
      const nativeKey = new Uint8Array(key);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        nativeKey,
        { name: "AES-GCM" },
        false,
        ["encrypt"],
      );

      const additionalData = new Uint8Array(BufferUtils.from("appointment-data"));
      const nativeIv = new Uint8Array(iv);
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: nativeIv, additionalData },
        cryptoKey,
        new Uint8Array(BufferUtils.from(data)),
      );

      // Extract tag from encrypted data (last 16 bytes)
      const encryptedArray = new Uint8Array(encrypted);
      const tag = encryptedArray.slice(-16);
      const ciphertext = encryptedArray.slice(0, -16);

      return {
        encrypted: ciphertext,
        iv,
        tag,
      };
    } else {
      // Node.js fallback using built-in crypto
      const nodeCrypto = await import("crypto");
      const cipher = nodeCrypto.createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(BufferUtils.from("appointment-data"));

      let encrypted = cipher.update(data, "utf8");
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const tag = cipher.getAuthTag();

      return {
        encrypted: new Uint8Array(encrypted),
        iv,
        tag: new Uint8Array(tag),
      };
    }
  }

  /**
   * Decrypts AES-256-GCM encrypted data
   * @param encrypted - The encrypted data
   * @param key - The 32-byte AES key
   * @param iv - The initialization vector
   * @param tag - The authentication tag
   * @returns Promise resolving to the decrypted plaintext string
   */
  static async decrypt(
    encrypted: CryptoBuffer,
    key: CryptoBuffer,
    iv: CryptoBuffer,
    tag: CryptoBuffer,
  ): Promise<string> {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      // Browser implementation using Web Crypto API
      // Ensure native Uint8Array with ArrayBuffer for Web Crypto API compatibility
      const nativeKey = new Uint8Array(key);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        nativeKey,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      );

      const additionalData = new Uint8Array(BufferUtils.from("appointment-data"));
      const nativeIv = new Uint8Array(iv);

      // Combine encrypted data and tag for Web Crypto API
      const encryptedWithTag = new Uint8Array(BufferUtils.concat([encrypted, tag]));

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nativeIv, additionalData },
        cryptoKey,
        encryptedWithTag,
      );

      return BufferUtils.toString(new Uint8Array(decrypted));
    } else {
      // Node.js fallback using built-in crypto
      const nodeCrypto = await import("crypto");
      const decipher = nodeCrypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(BufferUtils.from("appointment-data"));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString("utf8");
    }
  }
}

/**
 * Interface for Shamir secret sharing shares
 */
export interface ShamirShare {
  /** The x-coordinate of the share */
  x: number;
  /** The y-coordinate containing the share data */
  y: CryptoBuffer;
}

/**
 * Shamir Secret Sharing implementation using Lagrange interpolation over GF(256)
 *
 * This implementation uses polynomial interpolation in Galois Field 256 to split
 * a secret into n shares where any k shares can reconstruct the secret, but
 * k-1 shares reveal no information about the secret (information-theoretic security).
 *
 * Mathematical basis:
 * - Secret is encoded as f(0) where f is a polynomial of degree k-1
 * - Each share is a point (x, f(x)) on the polynomial
 * - Lagrange interpolation reconstructs f(0) from k points
 */
export class ShamirSecretSharing {
  // Cache for GF(256) multiplicative inverses
  private static invCache: Map<number, number> = new Map();

  /**
   * Splits a secret into multiple shares using Shamir's Secret Sharing scheme
   *
   * For a k-of-n threshold scheme:
   * - Generates a random polynomial f(x) of degree k-1 where f(0) = secret
   * - Creates n shares as points (i, f(i)) for i = 1, 2, ..., n
   * - Any k shares can reconstruct the secret via Lagrange interpolation
   *
   * @param secret - The secret to split (any length)
   * @param threshold - Minimum number of shares needed to reconstruct (k)
   * @param totalShares - Total number of shares to create (n)
   * @returns Array of ShamirShare objects
   */
  static splitSecret(secret: CryptoBuffer, threshold: number, totalShares: number): ShamirShare[] {
    return this.splitSecretInternal(secret, threshold, totalShares);
  }

  /**
   * Splits a secret into shares with a deterministic first share (2-of-2 scheme)
   *
   * Special case for client key splitting where:
   * - Share 1 (x=1): Deterministically derived from PIN + email (y₁ provided)
   * - Share 2 (x=2): Calculated to maintain the secret relationship
   *
   * This enables cross-device authentication:
   * - Client can always recreate share 1 from their PIN
   * - Server stores share 2 in database
   * - Both shares required for reconstruction (2-of-2 threshold)
   *
   * @param secret - The private key to split
   * @param deterministicShareY - The deterministic y-value for x=1 (from PIN derivation)
   * @returns Array with 2 shares: [pinShare, serverShare]
   */
  static splitSecretWithDeterministicShare(
    secret: CryptoBuffer,
    deterministicShareY: Uint8Array,
  ): ShamirShare[] {
    if (!secret || secret.length === 0) {
      throw new Error("Secret cannot be empty");
    }
    if (deterministicShareY.length !== secret.length) {
      throw new Error("Deterministic share must have same length as secret");
    }

    // For 2-of-2 Shamir: f(x) = a₀ + a₁·x where f(0) = secret
    // We have: f(1) = deterministicShareY (given)
    // From f(1) = a₀ + a₁·1: a₁ = f(1) - a₀ = deterministicShareY - secret (in GF(256))
    // Calculate f(2) = a₀ + a₁·2 = secret + 2·(deterministicShareY - secret)
    //                = 2·deterministicShareY - secret (in GF(256))

    const serverShareY = new Uint8Array(secret.length);

    for (let i = 0; i < secret.length; i++) {
      // a₁ = deterministicShareY[i] - secret[i] in GF(256)
      // Since subtraction in GF(256) is XOR (same as addition):
      const a1 = this.gf256Add(deterministicShareY[i], secret[i]);

      // f(2) = secret[i] + 2·a₁ in GF(256)
      const twoTimesA1 = this.gf256Mul(2, a1);
      serverShareY[i] = this.gf256Add(secret[i], twoTimesA1);
    }

    return [
      { x: 1, y: deterministicShareY },
      { x: 2, y: serverShareY },
    ];
  }

  /**
   * Internal implementation for splitting secrets
   */
  private static splitSecretInternal(
    secret: CryptoBuffer,
    threshold: number,
    totalShares: number,
  ): ShamirShare[] {
    if (!secret || secret.length === 0) {
      throw new Error("Secret cannot be empty for Shamir secret sharing");
    }
    if (threshold < 2) {
      throw new Error("Threshold must be at least 2");
    }
    if (threshold > totalShares) {
      throw new Error("Threshold cannot be greater than total shares");
    }
    if (totalShares > 255) {
      throw new Error("Cannot create more than 255 shares (GF(256) limitation)");
    }

    const shares: ShamirShare[] = [];

    // Process each byte of the secret independently
    for (let shareIndex = 0; shareIndex < totalShares; shareIndex++) {
      const x = shareIndex + 1; // x-coordinates: 1, 2, 3, ..., n (never 0, as f(0) = secret)
      const y = new Uint8Array(secret.length);

      for (let byteIndex = 0; byteIndex < secret.length; byteIndex++) {
        // For this byte, create a polynomial f(x) = a₀ + a₁x + a₂x² + ... + a_{k-1}x^{k-1}
        // where a₀ = secret[byteIndex] and a₁, ..., a_{k-1} are random
        const coefficients = new Uint8Array(threshold);
        coefficients[0] = secret[byteIndex]; // f(0) = secret byte

        // Generate random coefficients for higher degree terms
        for (let i = 1; i < threshold; i++) {
          coefficients[i] = Math.floor(Math.random() * 256);
        }

        // Evaluate polynomial at x: f(x) = a₀ + a₁x + a₂x² + ... in GF(256)
        let result = 0;
        for (let i = threshold - 1; i >= 0; i--) {
          result = this.gf256Add(this.gf256Mul(result, x), coefficients[i]);
        }

        y[byteIndex] = result;
      }

      shares.push({ x, y });
    }

    return shares;
  }

  /**
   * Reconstructs a secret from shares using Lagrange interpolation
   *
   * Given k shares (x₁, y₁), (x₂, y₂), ..., (xₖ, yₖ), reconstructs f(0) where:
   * f(0) = Σᵢ yᵢ · Lᵢ(0)
   * where Lᵢ(0) = Πⱼ≠ᵢ (0 - xⱼ) / (xᵢ - xⱼ) (computed in GF(256))
   *
   * @param shareArray - Array of shares to reconstruct from (must have at least threshold shares)
   * @returns The reconstructed secret
   */
  static reconstructSecret(shareArray: ShamirShare[]): CryptoBuffer {
    if (shareArray.length < 2) {
      throw new Error("Need at least 2 shares to reconstruct the secret");
    }

    const secretLength = shareArray[0].y.length;
    const secret = new Uint8Array(secretLength);

    // Reconstruct each byte independently
    for (let byteIndex = 0; byteIndex < secretLength; byteIndex++) {
      let secretByte = 0;

      // Lagrange interpolation: f(0) = Σᵢ yᵢ · Lᵢ(0)
      for (let i = 0; i < shareArray.length; i++) {
        const xi = shareArray[i].x;
        const yi = shareArray[i].y[byteIndex];

        // Calculate Lagrange basis polynomial Lᵢ(0)
        let basis = 1;
        for (let j = 0; j < shareArray.length; j++) {
          if (i !== j) {
            const xj = shareArray[j].x;
            // Lᵢ(0) *= (0 - xⱼ) / (xᵢ - xⱼ) in GF(256)
            // In GF(256), subtraction is XOR (same as addition)
            const numerator = this.gf256Add(0, xj); // 0 - xⱼ = 0 ⊕ xⱼ = xⱼ
            const denominator = this.gf256Add(xi, xj); // xᵢ - xⱼ = xᵢ ⊕ xⱼ
            basis = this.gf256Mul(basis, this.gf256Div(numerator, denominator));
          }
        }

        // Add yᵢ · Lᵢ(0) to the result
        secretByte = this.gf256Add(secretByte, this.gf256Mul(yi, basis));
      }

      secret[byteIndex] = secretByte;
    }

    return secret;
  }

  /**
   * Addition in GF(256) - simply XOR
   */
  private static gf256Add(a: number, b: number): number {
    return (a ^ b) & 0xff;
  }

  /**
   * Multiplication in GF(256) using the rijndael polynomial
   * This is the same multiplication used in AES
   */
  private static gf256Mul(a: number, b: number): number {
    let result = 0;
    a = a & 0xff;
    b = b & 0xff;

    for (let i = 0; i < 8; i++) {
      if (b & 1) {
        result ^= a;
      }
      const hiBitSet = a & 0x80;
      a = (a << 1) & 0xff;
      if (hiBitSet) {
        a ^= 0x1b; // Rijndael's Galois field polynomial
      }
      b >>= 1;
    }

    return result & 0xff;
  }

  /**
   * Division in GF(256) - multiply by multiplicative inverse
   */
  private static gf256Div(a: number, b: number): number {
    if (b === 0) {
      throw new Error("Division by zero in GF(256)");
    }
    return this.gf256Mul(a, this.gf256Inv(b));
  }

  /**
   * Multiplicative inverse in GF(256) using Extended Euclidean Algorithm
   */
  private static gf256Inv(a: number): number {
    if (a === 0) {
      throw new Error("Zero has no multiplicative inverse in GF(256)");
    }

    // Check cache first
    if (this.invCache.has(a)) {
      return this.invCache.get(a)!;
    }

    // Extended Euclidean Algorithm in GF(256)
    let u = a & 0xff;
    let v = 0x11b; // GF(256) irreducible polynomial: x^8 + x^4 + x^3 + x + 1
    let g1 = 1;
    let g2 = 0;

    let iterations = 0;
    const maxIterations = 16; // Should never need more than this

    while (u !== 1 && iterations < maxIterations) {
      iterations++;

      if (u === 0) {
        // This shouldn't happen, but safety check
        throw new Error(`GF(256) inverse failed for ${a}`);
      }

      const j = this.bitLength(u) - this.bitLength(v);

      if (j < 0) {
        [u, v] = [v, u];
        [g1, g2] = [g2, g1];
        continue;
      }

      u ^= v << j;
      g1 ^= g2 << j;
    }

    if (iterations >= maxIterations) {
      throw new Error(`GF(256) inverse calculation did not converge for ${a}`);
    }

    const result = g1 & 0xff;

    // Cache the result
    this.invCache.set(a, result);

    return result;
  }

  /**
   * Helper: Calculate bit length of a number
   */
  private static bitLength(n: number): number {
    let length = 0;
    while (n > 0) {
      length++;
      n >>= 1;
    }
    return length;
  }
}
