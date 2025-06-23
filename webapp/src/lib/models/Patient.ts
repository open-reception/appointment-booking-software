import {
  KyberCrypto,
  type KyberKeyPair,
  ShamirSecretSharing,
  type ShamirShare,
  type CryptoBuffer,
  BufferUtils
} from '../crypto/crypto-utils';

import { OptimizedArgon2 } from '../crypto/optimized-argon2';

export interface PatientData {
  patientId: string;
  email: string;
  publicKey: number[];
  serverShare: ShamirShare;
  browserShare?: ShamirShare;
  performanceInfo?: {
    argon2Implementation: string;
    keyGenTime: number;
    shamirSplitTime: number;
  };
}

export class Patient {
  public patientId: string;
  public email: string;
  public keyPair?: KyberKeyPair;
  public shares?: ShamirShare[];
  public serverShare?: ShamirShare;
  public browserShare?: ShamirShare;
  public performanceInfo?: {
    argon2Implementation: string;
    keyGenTime: number;
    shamirSplitTime: number;
  };

  constructor(email: string, patientId?: string) {
    this.email = email.toLowerCase();
    this.patientId = patientId || '';
  }

  static async create(email: string): Promise<Patient> {
    const patientId = await OptimizedArgon2.createPatientIdAsync(email);
    return new Patient(email, patientId);
  }

  async generateKeyPair(pin: string, argon2Options?: any): Promise<void> {
    const startTime = performance.now();
    
    const kyberStart = performance.now();
    this.keyPair = KyberCrypto.generateKeyPair();
    const kyberEnd = performance.now();
    
    const shamirStart = performance.now();
    
    console.log('🔑 Kyber private key length:', this.keyPair.privateKey.length);
    console.log('🔑 Kyber private key (first 32 bytes):', BufferUtils.toString(this.keyPair.privateKey.slice(0, 32), 'hex'));
    
    if (!this.keyPair.privateKey || this.keyPair.privateKey.length === 0) {
      throw new Error('Kyber private key is empty - cannot split with Shamir');
    }
    
    const shares = ShamirSecretSharing.splitSecret(
      this.keyPair.privateKey,
      2,
      3
    );
    const shamirEnd = performance.now();
    
    this.shares = shares;
    
    const argon2Start = performance.now();
    const pinDerivedKey = await OptimizedArgon2.deriveKeyFromPIN(pin, this.patientId, argon2Options);
    const argon2End = performance.now();
    
    (this.shares[0] as any).pinHash = BufferUtils.toString(pinDerivedKey.slice(0, 16), 'hex');
    
    this.serverShare = this.shares[1];
    this.browserShare = this.shares[2];
    
    const endTime = performance.now();
    
    const implInfo = await OptimizedArgon2.getImplementationInfo();
    
    this.performanceInfo = {
      argon2Implementation: implInfo,
      keyGenTime: kyberEnd - kyberStart,
      shamirSplitTime: shamirEnd - shamirStart
    };
    
    console.log(`🚀 Optimized Patient Key Generation:`);
    console.log(`   • Implementation: ${this.performanceInfo.argon2Implementation}`);
    console.log(`   • Kyber KeyGen: ${this.performanceInfo.keyGenTime.toFixed(2)}ms`);
    console.log(`   • Shamir Split: ${this.performanceInfo.shamirSplitTime.toFixed(2)}ms`);
    console.log(`   • Argon2 PIN: ${(argon2End - argon2Start).toFixed(2)}ms`);
    console.log(`   • Total Time: ${(endTime - startTime).toFixed(2)}ms`);
  }

  async reconstructPrivateKey(pin: string, serverShare?: ShamirShare, argon2Options?: any): Promise<CryptoBuffer> {
    const startTime = performance.now();
    
    if (!this.shares && !serverShare) {
      throw new Error('No shares available for reconstruction');
    }

    const argon2Start = performance.now();
    const pinDerivedKey = await OptimizedArgon2.deriveKeyFromPIN(pin, this.patientId, argon2Options);
    const argon2End = performance.now();
    
    const pinProtectedShare = this.shares![0];
    
    const storedPinHash = (pinProtectedShare as any).pinHash;
    const currentPinHash = BufferUtils.toString(pinDerivedKey.slice(0, 16), 'hex');
    
    if (storedPinHash !== currentPinHash) {
      throw new Error('Invalid PIN');
    }
    
    const decryptedPinShare: ShamirShare = {
      x: pinProtectedShare.x,
      y: pinProtectedShare.y
    };

    let reconstructionShares: ShamirShare[];
    
    if (this.browserShare) {
      reconstructionShares = [decryptedPinShare, this.browserShare];
    } else if (serverShare) {
      reconstructionShares = [decryptedPinShare, serverShare];
    } else {
      throw new Error('Need either browser share or server share for reconstruction');
    }

    const shamirStart = performance.now();
    const reconstructedKey = ShamirSecretSharing.reconstructSecret(reconstructionShares);
    const shamirEnd = performance.now();
    
    const endTime = performance.now();
    
    console.log(`🔑 Optimized Key Reconstruction:`);
    console.log(`   • Argon2 PIN: ${(argon2End - argon2Start).toFixed(2)}ms`);
    console.log(`   • Shamir Reconstruct: ${(shamirEnd - shamirStart).toFixed(2)}ms`);
    console.log(`   • Total Time: ${(endTime - startTime).toFixed(2)}ms`);
    
    return reconstructedKey;
  }

  toJSON(): any {
    if (!this.keyPair || !this.serverShare) {
      throw new Error('Patient not fully initialized');
    }

    return {
      patientId: this.patientId,
      email: this.email,
      publicKey: Array.from(this.keyPair.publicKey),
      serverShare: {
        x: this.serverShare.x,
        y: this.serverShare.y
      },
      browserShare: this.browserShare ? {
        x: this.browserShare.x,
        y: Array.from(this.browserShare.y)
      } : undefined,
      performanceInfo: this.performanceInfo
    };
  }

  static fromJSON(data: PatientData): Patient {
    const patient = new Patient(data.email, data.patientId);
    patient.keyPair = {
      publicKey: new Uint8Array(data.publicKey),
      privateKey: new Uint8Array(0)
    };
    patient.serverShare = {
      x: data.serverShare.x,
      y: new Uint8Array(data.serverShare.y)
    };
    if (data.browserShare) {
      patient.browserShare = {
        x: data.browserShare.x,
        y: new Uint8Array(data.browserShare.y)
      };
    }
    patient.performanceInfo = data.performanceInfo;
    return patient;
  }

  getPerformanceSummary(): string {
    if (!this.performanceInfo) {
      return 'No performance data available';
    }
    
    return `Implementation: ${this.performanceInfo.argon2Implementation}\n` +
           `Kyber KeyGen: ${this.performanceInfo.keyGenTime.toFixed(2)}ms\n` +
           `Shamir Split: ${this.performanceInfo.shamirSplitTime.toFixed(2)}ms`;
  }
}