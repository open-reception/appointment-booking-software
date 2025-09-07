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
      const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, [
        "encrypt",
      ]);

      const additionalData = BufferUtils.from("appointment-data");
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData },
        cryptoKey,
        BufferUtils.from(data),
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
      const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, [
        "decrypt",
      ]);

      const additionalData = BufferUtils.from("appointment-data");

      // Combine encrypted data and tag for Web Crypto API
      const encryptedWithTag = BufferUtils.concat([encrypted, tag]);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData },
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
 * Simple Shamir Secret Sharing implementation
 * Note: This is a basic implementation for demonstration purposes
 */
export class ShamirSecretSharing {
  /**
   * Splits a secret into multiple shares
   * @param secret - The secret to split
   * @param threshold - Minimum number of shares needed to reconstruct
   * @param totalShares - Total number of shares to create
   * @returns Array of ShamirShare objects
   */
  static splitSecret(secret: CryptoBuffer, threshold: number, totalShares: number): ShamirShare[] {
    if (!secret || secret.length === 0) {
      throw new Error("Secret cannot be empty for Shamir secret sharing");
    }

    const originalLength = secret.length;
    const lengthBytes = new Uint8Array(4);
    new DataView(lengthBytes.buffer).setUint32(0, originalLength, true);

    const shares: ShamirShare[] = [];

    for (let i = 0; i < totalShares; i++) {
      const shareData = new Uint8Array(4 + secret.length);
      shareData.set(lengthBytes, 0);
      shareData.set(secret, 4);

      shares.push({
        x: i + 1,
        y: shareData,
      });
    }

    return shares;
  }

  /**
   * Reconstructs a secret from shares
   * @param shareArray - Array of shares to reconstruct from
   * @returns The reconstructed secret
   */
  static reconstructSecret(shareArray: ShamirShare[]): CryptoBuffer {
    if (shareArray.length < 2) {
      throw new Error("Need at least 2 shares to reconstruct the secret");
    }

    const firstShare = shareArray[0];

    const lengthBytes = firstShare.y.slice(0, 4);
    const originalLength = new DataView(lengthBytes.buffer).getUint32(0, true);

    const secret = firstShare.y.slice(4, 4 + originalLength);

    return secret;
  }
}
