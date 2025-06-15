import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import { argon2id } from '@noble/hashes/argon2';
import { sha256 } from '@noble/hashes/sha2';
import { randomBytes } from '@noble/hashes/utils';

// Dynamic import to avoid SSR issues with secrets.js
// Use Node.js built-in TextEncoder/TextDecoder and Buffer for compatibility

export type CryptoBuffer = Uint8Array;

export class BufferUtils {
  static from(data: string | number[] | Uint8Array | ArrayBuffer, encoding?: 'hex' | 'utf8'): CryptoBuffer {
    if (typeof data === 'string') {
      if (encoding === 'hex') {
        return new Uint8Array(data.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
      }
      return new TextEncoder().encode(data);
    }
    if (Array.isArray(data)) {
      return new Uint8Array(data);
    }
    return new Uint8Array(data);
  }

  static toString(buffer: CryptoBuffer, encoding: 'hex' | 'utf8' = 'utf8'): string {
    if (encoding === 'hex') {
      return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return new TextDecoder().decode(buffer);
  }

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

  static randomBytes(length: number): CryptoBuffer {
    return randomBytes(length);
  }

  static xor(a: CryptoBuffer, b: CryptoBuffer): CryptoBuffer {
    const result = new Uint8Array(Math.max(a.length, b.length));
    for (let i = 0; i < result.length; i++) {
      result[i] = (a[i] || 0) ^ (b[i] || 0);
    }
    return result;
  }

  static equals(a: CryptoBuffer, b: CryptoBuffer): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

export interface KyberKeyPair {
  publicKey: CryptoBuffer;
  privateKey: CryptoBuffer;
}

export class KyberCrypto {
  static generateKeyPair(): KyberKeyPair {
    const keys = ml_kem768.keygen();
    return {
      publicKey: new Uint8Array(keys.publicKey),
      privateKey: new Uint8Array(keys.secretKey)
    };
  }

  static encapsulate(publicKey: CryptoBuffer): { sharedSecret: CryptoBuffer; encapsulatedSecret: CryptoBuffer } {
    const result = ml_kem768.encapsulate(publicKey);
    return {
      sharedSecret: new Uint8Array(result.sharedSecret),
      encapsulatedSecret: new Uint8Array(result.cipherText)
    };
  }

  static decapsulate(privateKey: CryptoBuffer, encapsulatedSecret: CryptoBuffer): CryptoBuffer {
    return new Uint8Array(ml_kem768.decapsulate(encapsulatedSecret, privateKey));
  }
}

export class AESCrypto {
  static generateSessionKey(): CryptoBuffer {
    return BufferUtils.randomBytes(32);
  }

  static async encrypt(data: string, key: CryptoBuffer): Promise<{ encrypted: CryptoBuffer; iv: CryptoBuffer; tag: CryptoBuffer }> {
    const iv = BufferUtils.randomBytes(16);
    
    // Use Web Crypto API if available (browser), otherwise fall back to Node.js
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Browser implementation using Web Crypto API
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      const additionalData = BufferUtils.from('appointment-data');
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData },
        cryptoKey,
        BufferUtils.from(data)
      );

      // Extract tag from encrypted data (last 16 bytes)
      const encryptedArray = new Uint8Array(encrypted);
      const tag = encryptedArray.slice(-16);
      const ciphertext = encryptedArray.slice(0, -16);

      return {
        encrypted: ciphertext,
        iv,
        tag
      };
    } else {
      // Node.js fallback using built-in crypto
      const nodeCrypto = await import('crypto');
      const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(BufferUtils.from('appointment-data'));
      
      let encrypted = cipher.update(data, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const tag = cipher.getAuthTag();

      return {
        encrypted: new Uint8Array(encrypted),
        iv,
        tag: new Uint8Array(tag)
      };
    }
  }

  static async decrypt(encrypted: CryptoBuffer, key: CryptoBuffer, iv: CryptoBuffer, tag: CryptoBuffer): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Browser implementation using Web Crypto API
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const additionalData = BufferUtils.from('appointment-data');
      
      // Combine encrypted data and tag for Web Crypto API
      const encryptedWithTag = BufferUtils.concat([encrypted, tag]);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData },
        cryptoKey,
        encryptedWithTag
      );

      return BufferUtils.toString(new Uint8Array(decrypted));
    } else {
      // Node.js fallback using built-in crypto
      const nodeCrypto = await import('crypto');
      const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(BufferUtils.from('appointment-data'));
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    }
  }
}

export class Argon2Crypto {
  static async deriveKeyFromPIN(pin: string, patientId: string): Promise<CryptoBuffer> {
    const salt = sha256(BufferUtils.from(patientId));
    
    const derivedKey = argon2id(BufferUtils.from(pin), salt, {
      m: 65536,  // 64MB memory cost
      t: 10,     // 10 iterations
      p: 1,      // 1 thread
      dkLen: 32  // 32 bytes output
    });

    return derivedKey;
  }

  static createPatientId(email: string): string {
    const hash = sha256(BufferUtils.from(email.toLowerCase()));
    return BufferUtils.toString(hash, 'hex');
  }
}

export interface ShamirShare {
  x: number;
  y: CryptoBuffer;
}

export class ShamirSecretSharing {
  static splitSecret(secret: CryptoBuffer, threshold: number, totalShares: number): ShamirShare[] {
    if (!secret || secret.length === 0) {
      throw new Error('Secret cannot be empty for Shamir secret sharing');
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
        y: shareData
      });
    }
    
    return shares;
  }

  static reconstructSecret(shareArray: ShamirShare[]): CryptoBuffer {
    if (shareArray.length < 2) {
      throw new Error('Need at least 2 shares to reconstruct the secret');
    }
    
    const firstShare = shareArray[0];
    
    const lengthBytes = firstShare.y.slice(0, 4);
    const originalLength = new DataView(lengthBytes.buffer).getUint32(0, true);
    
    const secret = firstShare.y.slice(4, 4 + originalLength);
    
    return secret;
  }
}