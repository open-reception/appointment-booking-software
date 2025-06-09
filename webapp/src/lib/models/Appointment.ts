import {
  AESCrypto,
  KyberCrypto,
  type CryptoBuffer,
  BufferUtils
} from '../crypto/crypto-utils';

export interface AppointmentDetails {
  patientName: string;
  patientEmail: string;
  reason: string;
  notes?: string;
  duration: number;
}

export interface EncryptedSessionKey {
  recipientId: string;
  encapsulatedSecret: number[];
  encryptedKey: number[];
  keyIv: number[];
  keyTag: number[];
}

export interface EncryptedAppointment {
  appointmentId: string;
  timestamp: string;
  encryptedData: number[];
  iv: number[];
  authTag: number[];
  sessionKeys: EncryptedSessionKey[];
}

export class Appointment {
  public appointmentId: string;
  public timestamp: Date;
  public details: AppointmentDetails;
  private sessionKey: CryptoBuffer;

  constructor(appointmentId: string, timestamp: Date, details: AppointmentDetails) {
    this.appointmentId = appointmentId;
    this.timestamp = timestamp;
    this.details = details;
    this.sessionKey = AESCrypto.generateSessionKey();
  }

  async encrypt(recipientPublicKeys: Map<string, CryptoBuffer>): Promise<EncryptedAppointment> {
    const dataToEncrypt = JSON.stringify(this.details);
    const { encrypted, iv, tag } = await AESCrypto.encrypt(dataToEncrypt, this.sessionKey);

    const sessionKeys: EncryptedSessionKey[] = [];

    for (const [recipientId, publicKey] of recipientPublicKeys) {
      const { sharedSecret, encapsulatedSecret } = KyberCrypto.encapsulate(publicKey);
      
      const sessionKeyHex = BufferUtils.toString(this.sessionKey, 'hex');
      const { encrypted: encryptedSessionKey, iv: sessionIv, tag: sessionTag } = 
        await AESCrypto.encrypt(sessionKeyHex, sharedSecret);
      
      sessionKeys.push({
        recipientId,
        encapsulatedSecret: Array.from(encapsulatedSecret),
        encryptedKey: Array.from(encryptedSessionKey),
        keyIv: Array.from(sessionIv),
        keyTag: Array.from(sessionTag)
      });
    }

    return {
      appointmentId: this.appointmentId,
      timestamp: this.timestamp.toISOString(),
      encryptedData: Array.from(encrypted),
      iv: Array.from(iv),
      authTag: Array.from(tag),
      sessionKeys
    };
  }

  static async decrypt(
    encryptedAppointment: EncryptedAppointment,
    recipientId: string,
    privateKey: CryptoBuffer
  ): Promise<Appointment> {
    const sessionKeyEntry = encryptedAppointment.sessionKeys.find(
      sk => sk.recipientId === recipientId
    );

    if (!sessionKeyEntry) {
      throw new Error(`No session key found for recipient ${recipientId}`);
    }

    const encapsulatedSecret = new Uint8Array(sessionKeyEntry.encapsulatedSecret);
    const sharedSecret = KyberCrypto.decapsulate(privateKey, encapsulatedSecret);
    
    const encryptedKey = new Uint8Array(sessionKeyEntry.encryptedKey);
    const keyIv = new Uint8Array(sessionKeyEntry.keyIv);
    const keyTag = new Uint8Array(sessionKeyEntry.keyTag);
    
    const sessionKeyHex = await AESCrypto.decrypt(encryptedKey, sharedSecret, keyIv, keyTag);
    const sessionKey = BufferUtils.from(sessionKeyHex, 'hex');

    const encryptedData = new Uint8Array(encryptedAppointment.encryptedData);
    const iv = new Uint8Array(encryptedAppointment.iv);
    const authTag = new Uint8Array(encryptedAppointment.authTag);
    
    const decryptedData = await AESCrypto.decrypt(encryptedData, sessionKey, iv, authTag);
    const details: AppointmentDetails = JSON.parse(decryptedData);

    return new Appointment(
      encryptedAppointment.appointmentId,
      new Date(encryptedAppointment.timestamp),
      details
    );
  }

  updateDetails(newDetails: Partial<AppointmentDetails>): void {
    this.details = { ...this.details, ...newDetails };
  }

  static generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint32Array(3);
      crypto.getRandomValues(array);
      return 'apt_' + Array.from(array).map(x => x.toString(36)).join('') + '_' + Date.now();
    } else {
      return 'apt_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
  }
}