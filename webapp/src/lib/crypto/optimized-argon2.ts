/**
 * Optimized Argon2 Implementation
 * 
 * Uses native Node.js argon2 for maximum performance
 * Falls back to argon2-browser WASM in browsers
 * Final fallback to @noble/hashes if neither available
 */

import type { CryptoBuffer } from './crypto-utils';
import { BufferUtils } from './crypto-utils';

export interface Argon2Options {
  memoryCost?: number;
  timeCost?: number;
  parallelism?: number;
  hashLength?: number;
}

export class OptimizedArgon2 {
  static async deriveKeyFromPIN(
    pin: string, 
    patientId: string, 
    options: Argon2Options = {}
  ): Promise<CryptoBuffer> {
    const defaultOptions = {
      memoryCost: 65536,
      timeCost: 10,
      parallelism: 1,
      hashLength: 32
    };
    
    const opts = { ...defaultOptions, ...options };
    
    if (typeof window !== 'undefined') {
      // Browser environment - use argon2-browser WASM
      return await this.deriveKeyBrowser(pin, patientId, opts);
    } else {
      // Node.js environment - use native argon2
      return await this.deriveKeyNode(pin, patientId, opts);
    }
  }

  private static async deriveKeyNode(
    pin: string, 
    patientId: string, 
    options: Required<Argon2Options>
  ): Promise<CryptoBuffer> {
    try {
      const crypto = await import('crypto');
      const salt = crypto.createHash('sha256').update(patientId).digest();
      
      try {
        const argon2 = await import('argon2');
        const hash = await argon2.hash(pin, {
          type: argon2.argon2id,
          memoryCost: options.memoryCost,
          timeCost: options.timeCost,
          parallelism: options.parallelism,
          salt: salt,
          raw: true,
          hashLength: options.hashLength
        });
        return new Uint8Array(hash);
      } catch (error) {
        console.warn('Native argon2 unavailable, falling back to @noble/hashes');
        return await this.deriveKeyFallback(pin, salt, options);
      }
    } catch (error) {
      throw new Error(`Failed to derive key in Node.js: ${error}`);
    }
  }

  private static async deriveKeyBrowser(
    pin: string, 
    patientId: string, 
    options: Required<Argon2Options>
  ): Promise<CryptoBuffer> {
    try {
      // Create salt from patient ID using Web Crypto API
      const encoder = new TextEncoder();
      const saltData = await crypto.subtle.digest('SHA-256', encoder.encode(patientId));
      const salt = new Uint8Array(saltData);
      
      // Try to use argon2-browser WASM (from static files)
      try {
        console.log('🔍 Checking for argon2-browser from static files...');
        const argon2 = (window as any).argon2;
        
        if (argon2) {
          console.log('✅ argon2-browser found from static files');
          console.log('argon2 object:', argon2);
          console.log('ArgonType:', argon2.ArgonType);
          
          const result = await argon2.hash({
            pass: pin,
            salt: Array.from(salt),
            type: argon2.ArgonType.Argon2id,
            mem: options.memoryCost,
            time: options.timeCost,
            parallelism: options.parallelism,
            hashLen: options.hashLength
          });
          
          console.log('✅ Argon2 WASM hash successful');
          return new Uint8Array(result.hash);
        } else {
          console.warn('❌ argon2-browser not available on window');
          throw new Error('argon2-browser not available');
        }
      } catch (error) {
        console.warn('❌ argon2-browser static files unavailable, falling back to @noble/hashes:', error);
        return await this.deriveKeyFallback(pin, salt, options);
      }
    } catch (error) {
      throw new Error(`Failed to derive key in browser: ${error}`);
    }
  }

  private static async deriveKeyFallback(
    pin: string, 
    salt: CryptoBuffer, 
    options: Required<Argon2Options>
  ): Promise<CryptoBuffer> {
    const { argon2id } = await import('@noble/hashes/argon2');
    
    return argon2id(BufferUtils.from(pin), new Uint8Array(salt), {
      m: options.memoryCost,
      t: options.timeCost,
      p: options.parallelism,
      dkLen: options.hashLength
    });
  }

  static createPatientId(email: string): string {
    if (typeof window !== 'undefined') {
      // Browser environment - use Web Crypto API
      const hash = crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase()));
      return BufferUtils.toString(new Uint8Array(hash), 'hex');
    } else {
      // Node.js environment - this will be handled at runtime
      throw new Error('createPatientId should be called asynchronously in Node.js environment');
    }
  }

  static async createPatientIdAsync(email: string): Promise<string> {
    if (typeof window !== 'undefined') {
      // Browser environment
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase()));
      return BufferUtils.toString(new Uint8Array(hash), 'hex');
    } else {
      // Node.js environment
      const crypto = await import('crypto');
      return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
    }
  }

  static async getImplementationInfo(): Promise<string> {
    if (typeof window !== 'undefined') {
      if ((window as any).argon2) {
        return 'argon2-browser WASM (static files)';
      }
      return '@noble/hashes (JavaScript fallback)';
    } else {
      try {
        await import('argon2');
        return 'Native Node.js argon2 (C++ addon)';
      } catch {
        return '@noble/hashes (JavaScript fallback)';
      }
    }
  }
}