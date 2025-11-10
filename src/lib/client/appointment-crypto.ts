/**
 * Unified End-to-End Encryption for Appointments
 *
 * This class implements browser-side cryptography for both clients and staff members.
 * All sensitive operations happen in the browser with zero-knowledge architecture.
 *
 * ## Client (Patient) Usage:
 * ```javascript
 * const crypto = new UnifiedAppointmentCrypto();
 * await crypto.initNewClient(email, pin, tenantId);
 * await crypto.loginExistingClient(email, pin, tenantId);
 * const appointment = await crypto.createAppointment(appointmentData, appointmentDate, channelId, tenantId);
 * const myAppointments = await crypto.getMyAppointments(tenantId);
 * ```
 *
 * ## Staff Usage:
 * ```javascript
 * const crypto = new UnifiedAppointmentCrypto();
 * await crypto.authenticateStaff(staffId, tenantId);
 * const appointments = await crypto.getStaffAppointments(tenantId);
 * const decrypted = await crypto.decryptStaffAppointment(encryptedData);
 * ```
 *
 * ## Staff Key Management (during Passkey Registration):
 * ```javascript
 * // 1. Generate Kyber keypair in browser
 * const keyPair = KyberCrypto.generateKeyPair();
 *
 * // 2. Derive passkey-based shard from WebAuthn authenticatorData
 * const passkeyBasedShard = await this.derivePasskeyBasedShard(passkeyId, authenticatorData);
 *
 * // 3. Create database shard using XOR split
 * const dbShard = new Uint8Array(keyPair.privateKey.length);
 * for (let i = 0; i < keyPair.privateKey.length; i++) {
 *   dbShard[i] = keyPair.privateKey[i] ^ passkeyBasedShard[i];
 * }
 *
 * // 4. Store keys via StaffCryptoService API
 * await fetch(`/api/tenants/${tenantId}/staff/${userId}/crypto`, {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     passkeyId,
 *     publicKey: this.uint8ArrayToBase64(keyPair.publicKey),
 *     privateKeyShare: this.uint8ArrayToBase64(dbShard)
 *   })
 * });
 * ```
 */

import { OptimizedArgon2 } from "$lib/crypto/hashing";
import { KyberCrypto, AESCrypto, ShamirSecretSharing } from "$lib/crypto/utils";

// Type definitions for unified cryptography
interface ClientKeyPair {
  publicKey: string;
  privateKey: string;
}

interface StaffKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

interface EncryptedData {
  encryptedPayload: string;
  iv: string;
  authTag: string;
}

interface AppointmentData {
  name: string;
  email: string;
  phone?: string;
}

interface StaffPublicKey {
  userId: string;
  publicKey: string;
}

interface DecryptedAppointment {
  id: string;
  appointmentDate: string;
  status: string;
  name: string;
  email: string;
  phone?: string;
}

interface MyAppointmentsResponse {
  appointments: Array<{
    id: string;
    appointmentDate: string;
    status: string;
    encryptedData: EncryptedData;
  }>;
}

export class UnifiedAppointmentCrypto {
  // Client-specific properties
  private tunnelKey: CryptoKey | null = null;
  private clientKeyPair: ClientKeyPair | null = null;
  private emailHash: string | null = null;
  private tunnelId: string | null = null;
  private clientAuthenticated: boolean = false;

  // Staff-specific properties
  private staffKeyPair: StaffKeyPair | null = null;
  private staffId: string | null = null;
  private tenantId: string | null = null;
  private staffAuthenticated: boolean = false;
  private keyExpiry: number | null = null;

  // Shared crypto utilities
  private kyberCrypto: KyberCrypto = new KyberCrypto();
  private aesCrypto: AESCrypto = new AESCrypto();
  private shamirSharing: ShamirSecretSharing = new ShamirSecretSharing();

  // ===== CLIENT (PATIENT) METHODS =====

  /**
   * Initializes a new client with E2E encryption
   */
  async initNewClient(email: string, pin: string, tenantId: string): Promise<void> {
    try {
      // 1. Generate email hash for privacy-preserving lookup
      this.emailHash = await this.hashEmail(email);

      // 2. Generate tunnel ID
      this.tunnelId = this.generateTunnelId();

      // 3. Generate ML-KEM-768 keypair
      this.clientKeyPair = await this.generateClientKeyPair();

      // 4. Generate tunnel key for AES encryption
      this.tunnelKey = await this.generateTunnelKey();

      // 5. Split private key into Shamir shares (2-of-2)
      // Note: privateKeyShare will be used during actual appointment creation
      await this.createPrivateKeyShare(this.clientKeyPair.privateKey, pin);

      // 6. Fetch staff public keys from server
      const staffPublicKeys = await this.fetchStaffPublicKeys(tenantId);

      // 7. Encrypt tunnel key for all staff members
      // Note: staffKeyShares will be used during actual appointment creation
      await this.encryptTunnelKeyForStaff(staffPublicKeys);

      // 8. Encrypt tunnel key for client (for later use)
      // Note: clientKeyShare will be used during actual appointment creation
      await this.encryptTunnelKeyForClient();

      console.log("✅ New client initialized", {
        tunnelId: this.tunnelId,
        emailHashPrefix: this.emailHash.slice(0, 8),
        staffCount: staffPublicKeys.length,
      });

      this.clientAuthenticated = true;
    } catch (error) {
      console.error("❌ Error during client initialization:", error);
      throw error;
    }
  }

  /**
   * Authenticates an existing client using challenge-response
   */
  async loginExistingClient(email: string, pin: string, tenantId: string): Promise<void> {
    try {
      // 1. Generate email hash
      this.emailHash = await this.hashEmail(email);

      // 2. Request challenge from server
      const challengeResponse = await fetch(`/api/tenants/${tenantId}/appointments/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailHash: this.emailHash }),
      });

      if (!challengeResponse.ok) {
        throw new Error("Challenge could not be retrieved");
      }

      const challengeData = await challengeResponse.json();

      // 3. Reconstruct private key from PIN and server share
      const privateKey = await this.reconstructPrivateKey(pin, challengeData.privateKeyShare);

      // 4. Decrypt challenge
      const decryptedChallenge = await this.decryptChallenge(
        challengeData.encryptedChallenge,
        privateKey,
      );

      // 5. Send challenge response to server
      const verificationResponse = await fetch(
        `/api/tenants/${tenantId}/appointments/verify-challenge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailHash: this.emailHash,
            challengeResponse: decryptedChallenge,
          }),
        },
      );

      if (!verificationResponse.ok) {
        throw new Error("Challenge verification failed");
      }

      const verificationData = await verificationResponse.json();

      // 6. Decrypt tunnel key
      this.tunnelKey = await this.decryptTunnelKey(verificationData.encryptedTunnelKey, privateKey);

      console.log("✅ Existing client authenticated");
      this.clientAuthenticated = true;
    } catch (error) {
      console.error("❌ Error during client login:", error);
      throw error;
    }
  }

  /**
   * Creates a new encrypted appointment
   */
  async createAppointment(
    appointmentData: AppointmentData,
    appointmentDate: string,
    channelId: string,
    tenantId: string,
    isFirstAppointment: boolean = false,
  ): Promise<string> {
    if (!this.clientAuthenticated || !this.tunnelKey) {
      throw new Error("Client not authenticated");
    }

    try {
      // 1. Encrypt appointment data
      const encryptedAppointment = await this.encryptAppointmentData(appointmentData);

      // 2. Call appropriate endpoint
      const endpoint = isFirstAppointment
        ? `/api/tenants/${tenantId}/appointments/create-new-client`
        : `/api/tenants/${tenantId}/appointments/add-to-tunnel`;

      const requestData = isFirstAppointment
        ? {
            // New client
            tunnelId: this.tunnelId,
            channelId,
            appointmentDate,
            emailHash: this.emailHash,
            clientPublicKey: this.clientKeyPair?.publicKey,
            privateKeyShare: await this.getPrivateKeyShare(),
            encryptedAppointment,
            staffKeyShares: await this.getStaffKeyShares(tenantId),
            clientKeyShare: await this.getClientKeyShare(),
          }
        : {
            // Existing client
            emailHash: this.emailHash,
            tunnelId: this.tunnelId!,
            channelId,
            appointmentDate,
            encryptedAppointment,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error("Appointment could not be created");
      }

      const result = await response.json();

      console.log("✅ Encrypted appointment created:", result.id);
      return result.id;
    } catch (error) {
      console.error("❌ Error creating appointment:", error);
      throw error;
    }
  }

  /**
   * Retrieves all appointments for this client
   */
  async getMyAppointments(tenantId: string): Promise<DecryptedAppointment[]> {
    if (!this.clientAuthenticated || !this.tunnelKey) {
      throw new Error("Client not authenticated");
    }

    try {
      const response = await fetch(`/api/tenants/${tenantId}/appointments/my-appointments`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Email-Hash": this.emailHash!,
        },
      });

      if (!response.ok) {
        throw new Error("Appointments could not be retrieved");
      }

      const data: MyAppointmentsResponse = await response.json();

      // Decrypt each appointment
      const decryptedAppointments: DecryptedAppointment[] = [];
      for (const encryptedAppt of data.appointments) {
        try {
          const decryptedData = await this.decryptAppointmentData(encryptedAppt.encryptedData);
          decryptedAppointments.push({
            id: encryptedAppt.id,
            appointmentDate: encryptedAppt.appointmentDate,
            status: encryptedAppt.status,
            ...decryptedData,
          });
        } catch (error) {
          console.warn("Failed to decrypt appointment", encryptedAppt.id, error);
        }
      }

      return decryptedAppointments;
    } catch (error) {
      console.error("❌ Error retrieving appointments:", error);
      throw error;
    }
  }

  // ===== STAFF METHODS =====

  /**
   * Authenticate staff member using WebAuthn and reconstruct private key from shards
   */
  async authenticateStaff(staffId: string, tenantId: string): Promise<void> {
    try {
      console.log("🔐 Authenticasting staff member:", staffId, "for tenant:", tenantId);

      // 1. Perform WebAuthn authentication
      const webAuthnResponse = await this.performWebAuthnAuthentication(staffId);

      // 2. Fetch database shard from server
      const shardResponse = await fetch(`/api/tenants/${tenantId}/staff/${staffId}/key-shard`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!shardResponse.ok) {
        throw new Error(`Failed to fetch key shard: ${shardResponse.status}`);
      }

      const shardData = await shardResponse.json();

      // 3. Derive passkey-based shard from WebAuthn response
      const passkeyBasedShard = await this.derivePasskeyBasedShard(
        shardData.passkeyId,
        webAuthnResponse.authenticatorData,
      );

      // 4. Decode database shard
      const dbShard = this.base64ToUint8Array(shardData.privateKeyShare);

      // 5. Reconstruct private key by XORing the two shards
      const privateKey = new Uint8Array(dbShard.length);
      for (let i = 0; i < dbShard.length; i++) {
        privateKey[i] = dbShard[i] ^ passkeyBasedShard[i];
      }

      // 6. Store reconstructed key pair
      this.staffKeyPair = {
        publicKey: this.base64ToUint8Array(shardData.publicKey),
        privateKey: privateKey,
      };

      this.staffId = staffId;
      this.tenantId = tenantId;
      this.staffAuthenticated = true;
      this.keyExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

      console.log("✅ Staff authentication successful");
    } catch (error) {
      console.error("❌ Staff authentication failed:", error);
      throw new Error(
        `Staff authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Decrypt appointment data for staff members
   */
  async decryptStaffAppointment(encryptedData: {
    encryptedAppointment: EncryptedData;
    staffKeyShare: string;
  }): Promise<AppointmentData> {
    if (!this.staffAuthenticated || !this.staffKeyPair) {
      throw new Error("Staff not authenticated");
    }

    if (this.keyExpiry && Date.now() > this.keyExpiry) {
      throw new Error("Staff session expired - please authenticate again");
    }

    try {
      // 1. Decrypt the symmetric key using staff's private key
      const encapsulatedSecret = this.hexToUint8Array(encryptedData.staffKeyShare);
      const sharedSecret = KyberCrypto.decapsulate(
        this.staffKeyPair.privateKey,
        encapsulatedSecret,
      );

      // 2. Import the symmetric key
      const symmetricKey = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(sharedSecret),
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      );

      // 3. Decrypt the appointment data
      const iv = this.hexToUint8Array(encryptedData.encryptedAppointment.iv);
      const ciphertext = this.hexToUint8Array(encryptedData.encryptedAppointment.encryptedPayload);
      const authTag = this.hexToUint8Array(encryptedData.encryptedAppointment.authTag);

      // Combine ciphertext and auth tag for Web Crypto API
      const encrypted = new Uint8Array(ciphertext.length + authTag.length);
      encrypted.set(ciphertext);
      encrypted.set(authTag, ciphertext.length);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(iv) },
        symmetricKey,
        encrypted,
      );

      const decoder = new TextDecoder();
      const plaintext = decoder.decode(decrypted);
      return JSON.parse(plaintext);
    } catch (error) {
      console.error("❌ Failed to decrypt staff appointment:", error);
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all appointments for staff in a tenant
   */
  async getStaffAppointments(tenantId: string): Promise<DecryptedAppointment[]> {
    if (!this.staffAuthenticated) {
      throw new Error("Staff not authenticated");
    }

    try {
      const response = await fetch(`/api/tenants/${tenantId}/appointments/staff-appointments`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Staff-ID": this.staffId!,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch staff appointments");
      }

      const data = await response.json();
      const decryptedAppointments: DecryptedAppointment[] = [];

      for (const encryptedAppt of data.appointments) {
        try {
          const decryptedData = await this.decryptStaffAppointment({
            encryptedAppointment: encryptedAppt.encryptedData,
            staffKeyShare: encryptedAppt.staffKeyShare,
          });

          decryptedAppointments.push({
            id: encryptedAppt.id,
            appointmentDate: encryptedAppt.appointmentDate,
            status: encryptedAppt.status,
            ...decryptedData,
          });
        } catch (error) {
          console.warn("Failed to decrypt staff appointment", encryptedAppt.id, error);
        }
      }

      return decryptedAppointments;
    } catch (error) {
      console.error("❌ Error retrieving staff appointments:", error);
      throw error;
    }
  }

  /**
   * Logout staff member and clear sensitive data
   */
  logoutStaff(): void {
    this.staffKeyPair = null;
    this.staffId = null;
    this.tenantId = null;
    this.staffAuthenticated = false;
    this.keyExpiry = null;
    console.log("🔒 Staff logged out");
  }

  /**
   * Logout client and clear sensitive data
   */
  logoutClient(): void {
    this.tunnelKey = null;
    this.clientKeyPair = null;
    this.emailHash = null;
    this.tunnelId = null;
    this.clientAuthenticated = false;
    console.log("🔒 Client logged out");
  }

  // ===== SHARED PRIVATE METHODS =====

  /**
   * Perform WebAuthn authentication for staff
   */
  private async performWebAuthnAuthentication(staffId: string): Promise<{
    authenticatorData: ArrayBuffer;
    signature: ArrayBuffer;
    userHandle: ArrayBuffer | null;
  }> {
    // 1. Get authentication options from server
    const optionsResponse = await fetch("/api/auth/webauthn/authenticate/begin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: staffId }),
    });

    if (!optionsResponse.ok) {
      throw new Error("Failed to get WebAuthn options");
    }

    const options = await optionsResponse.json();

    // 2. Perform WebAuthn authentication
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(this.base64ToUint8Array(options.challenge)),
        allowCredentials: options.allowCredentials?.map((cred: { id: string; type: string }) => ({
          id: new Uint8Array(this.base64ToUint8Array(cred.id)),
          type: cred.type as PublicKeyCredentialType,
        })),
        timeout: options.timeout,
        userVerification: options.userVerification,
      },
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error("WebAuthn authentication failed");
    }

    const response = credential.response as AuthenticatorAssertionResponse;

    return {
      authenticatorData: response.authenticatorData,
      signature: response.signature,
      userHandle: response.userHandle,
    };
  }

  /**
   * Store the staff key pair after the registration of a new staff member
   */
  public async storeStaffKeyPair(
    tenantId: string,
    staffId: string,
    passkeyId: string,
    authenticatorData: ArrayBuffer,
  ): Promise<void> {
    const keyPair = KyberCrypto.generateKeyPair();

    const passkeyBasedShard = await this.derivePasskeyBasedShard(passkeyId, authenticatorData);

    const dbShard = new Uint8Array(keyPair.privateKey.length);
    for (let i = 0; i < keyPair.privateKey.length; i++) {
      dbShard[i] = keyPair.privateKey[i] ^ passkeyBasedShard[i];
    }

    await fetch(`/api/tenants/${tenantId}/staff/${staffId}/crypto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        passkeyId,
        publicKey: this.uint8ArrayToBase64(keyPair.publicKey),
        privateKeyShare: this.uint8ArrayToBase64(dbShard),
      }),
    });
  }

  private uint8ArrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
  }

  /**
   * Derive a deterministic shard from passkey authentication data
   *
   * This method creates a consistent private key shard from WebAuthn authenticatorData.
   * The same passkey will always produce the same shard, enabling key reconstruction.
   *
   * Used in Staff Key Management:
   * - During registration: Create shard to XOR with private key for database storage
   * - During authentication: Recreate same shard to reconstruct private key
   *
   * Uses HKDF (HMAC-based Key Derivation Function) with:
   * - IKM: WebAuthn authenticatorData (contains randomness from authenticator)
   * - Salt: "staff-crypto-shard-v1" (version-specific salt)
   * - Info: "passkey:{passkeyId}" (domain separation per passkey)
   * - Length: 2400 bytes (ML-KEM-768 private key size)
   */
  private async derivePasskeyBasedShard(
    passkeyId: string,
    authenticatorData: ArrayBuffer,
  ): Promise<Uint8Array> {
    // Extract randomness from authenticator data
    const inputKeyMaterial = new Uint8Array(authenticatorData);

    // Import the IKM as a CryptoKey for HKDF
    const ikmKey = await crypto.subtle.importKey("raw", inputKeyMaterial, "HKDF", false, [
      "deriveBits",
    ]);

    // Salt for HKDF
    const salt = new TextEncoder().encode("staff-crypto-shard-v1");

    // Info for HKDF (domain separation with passkey ID)
    const info = new TextEncoder().encode(`passkey:${passkeyId}`);

    // Derive key material with the length needed for Kyber private key (2400 bytes for ML-KEM-768)
    const keyMaterial = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: salt,
        info: info,
      },
      ikmKey,
      2400 * 8, // 2400 bytes * 8 bits
    );

    return new Uint8Array(keyMaterial);
  }

  /**
   * Generate deterministic SHA-256 hash of email for privacy-preserving lookups
   */
  private async hashEmail(email: string): Promise<string> {
    const emailNormalized = email.toLowerCase().trim();
    const encoder = new TextEncoder();
    const data = encoder.encode(emailNormalized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Generate ML-KEM-768 keypair for clients
   */
  private async generateClientKeyPair(): Promise<ClientKeyPair> {
    const keyPair = KyberCrypto.generateKeyPair();
    return {
      publicKey: Array.from(keyPair.publicKey)
        .map((b: number) => b.toString(16).padStart(2, "0"))
        .join(""),
      privateKey: Array.from(keyPair.privateKey)
        .map((b: number) => b.toString(16).padStart(2, "0"))
        .join(""),
    };
  }

  /**
   * Generate AES-256-GCM tunnel key
   */
  private async generateTunnelKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
  }

  /**
   * Encrypt appointment data with the tunnel key
   */
  private async encryptAppointmentData(data: AppointmentData): Promise<EncryptedData> {
    if (!this.tunnelKey) throw new Error("No tunnel key available");

    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(data));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.tunnelKey,
      plaintext,
    );

    const encryptedArray = new Uint8Array(encrypted);
    const authTag = encryptedArray.slice(-16);
    const ciphertext = encryptedArray.slice(0, -16);

    return {
      encryptedPayload: Array.from(ciphertext)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      iv: Array.from(iv)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      authTag: Array.from(authTag)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    };
  }

  /**
   * Decrypt appointment data with the tunnel key
   */
  private async decryptAppointmentData(encryptedData: EncryptedData): Promise<AppointmentData> {
    if (!this.tunnelKey) throw new Error("No tunnel key available");

    const iv = this.hexToUint8Array(encryptedData.iv);
    const ciphertext = this.hexToUint8Array(encryptedData.encryptedPayload);
    const authTag = this.hexToUint8Array(encryptedData.authTag);

    // Combine ciphertext and auth tag
    const encrypted = new Uint8Array(ciphertext.length + authTag.length);
    encrypted.set(ciphertext);
    encrypted.set(authTag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      this.tunnelKey,
      encrypted,
    );

    const decoder = new TextDecoder();
    const plaintext = decoder.decode(decrypted);
    return JSON.parse(plaintext);
  }

  // ===== UTILITY METHODS =====

  private generateTunnelId(): string {
    return "tunnel_" + crypto.randomUUID();
  }

  private async createPrivateKeyShare(privateKey: string, pin: string): Promise<string> {
    // Use Shamir Secret Sharing for private key
    const privateKeyBytes = this.hexToUint8Array(privateKey);
    const shares = ShamirSecretSharing.splitSecret(privateKeyBytes, 2, 2);

    // One share is PIN-encrypted and stored on client
    const clientShare = shares[0].y;
    const pinHash = await OptimizedArgon2.deriveKeyFromPIN(pin, this.emailHash || "");
    const encryptedShare = await AESCrypto.encrypt(this.uint8ArrayToHex(clientShare), pinHash);

    return this.uint8ArrayToHex(encryptedShare.encrypted);
  }

  private async fetchStaffPublicKeys(tenantId: string): Promise<StaffPublicKey[]> {
    const response = await fetch(`/api/tenants/${tenantId}/appointments/staff-public-keys`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch staff public keys: ${response.statusText}`);
    }

    const data = await response.json();
    return data.staffPublicKeys;
  }

  // getTenantId method removed - tenantId is now always passed explicitly

  private async encryptTunnelKeyForStaff(
    staffKeys: StaffPublicKey[],
  ): Promise<Array<{ userId: string; encryptedTunnelKey: string }>> {
    if (!this.tunnelKey) throw new Error("No tunnel key available");

    const results = [];

    for (const staff of staffKeys) {
      // Public key is stored as Base64, not Hex
      const staffPublicKeyBytes = this.base64ToUint8Array(staff.publicKey);
      const encryptedKey = KyberCrypto.encapsulate(staffPublicKeyBytes);

      results.push({
        userId: staff.userId,
        encryptedTunnelKey: this.uint8ArrayToHex(encryptedKey.encapsulatedSecret),
      });
    }

    return results;
  }

  private async encryptTunnelKeyForClient(): Promise<string> {
    if (!this.tunnelKey || !this.clientKeyPair)
      throw new Error("Tunnel key or client key not available");

    const clientPublicKeyBytes = this.hexToUint8Array(this.clientKeyPair.publicKey);
    const encryptedKey = KyberCrypto.encapsulate(clientPublicKeyBytes);

    return this.uint8ArrayToHex(encryptedKey.encapsulatedSecret);
  }

  private async reconstructPrivateKey(pin: string, serverShare: string): Promise<string> {
    // For now, simplified reconstruction - in real implementation this would be more complex
    // TODO: Implement proper Shamir reconstruction with PIN-derived decryption
    const serverShareBytes = this.hexToUint8Array(serverShare);
    const clientShareBytes = serverShareBytes; // Simplified for now

    // In future: derive pinHash and use it to decrypt the client share
    // const pinHash = await OptimizedArgon2.deriveKeyFromPIN(pin, this.emailHash || "");

    // Reconstruct private key from both shares
    const shares = [
      { x: 1, y: clientShareBytes },
      { x: 2, y: serverShareBytes },
    ];
    const reconstructedKey = ShamirSecretSharing.reconstructSecret(shares);

    return this.uint8ArrayToHex(reconstructedKey);
  }

  private async decryptChallenge(encryptedChallenge: string, privateKey: string): Promise<string> {
    const privateKeyBytes = this.hexToUint8Array(privateKey);
    const challengeBytes = this.hexToUint8Array(encryptedChallenge);

    const sharedSecret = KyberCrypto.decapsulate(privateKeyBytes, challengeBytes);
    return this.uint8ArrayToHex(sharedSecret);
  }

  private async decryptTunnelKey(
    encryptedTunnelKey: string,
    privateKey: string,
  ): Promise<CryptoKey> {
    const privateKeyBytes = this.hexToUint8Array(privateKey);
    const encryptedKeyBytes = this.hexToUint8Array(encryptedTunnelKey);

    const tunnelKeyBytes = KyberCrypto.decapsulate(privateKeyBytes, encryptedKeyBytes);

    return await crypto.subtle.importKey(
      "raw",
      new Uint8Array(tunnelKeyBytes),
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"],
    );
  }

  // Helper methods for completing the API
  private async getPrivateKeyShare(): Promise<string> {
    if (!this.clientKeyPair) throw new Error("Client keypair not available");
    // TODO: Return the actual server share from Shamir splitting
    return this.clientKeyPair.privateKey; // Simplified for now
  }

  private async getStaffKeyShares(
    tenantId: string,
  ): Promise<Array<{ userId: string; encryptedTunnelKey: string }>> {
    // Fetch and encrypt tunnel key for all staff members
    const staffPublicKeys = await this.fetchStaffPublicKeys(tenantId);
    return await this.encryptTunnelKeyForStaff(staffPublicKeys);
  }

  private async getClientKeyShare(): Promise<string> {
    // Return the client's encrypted tunnel key
    return await this.encryptTunnelKeyForClient();
  }

  // Encoding/decoding utilities
  private hexToUint8Array(hex: string): Uint8Array {
    return new Uint8Array(hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
  }

  private uint8ArrayToHex(array: Uint8Array): string {
    return Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    return new Uint8Array(Array.from(atob(base64)).map((c) => c.charCodeAt(0)));
  }
}
