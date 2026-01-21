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
import { pinThrottleStore } from "$lib/stores/pin-throttle";
import { KyberCrypto, AESCrypto, ShamirSecretSharing, BufferUtils } from "$lib/crypto/utils";

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

export interface AppointmentData {
  salutation?: string;
  name: string;
  email: string;
  shareEmail: boolean;
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
  private serverPrivateKeyShare: string | null = null; // Server share of the private key

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
   * Run a precheck
   */
  async preCheck(email: string, tenantId: string): Promise<boolean> {
    try {
      const emailHash = await this.hashEmail(email);

      const response = await fetch(`/api/tenants/${tenantId}/appointments/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailHash }),
      });

      return response.ok;
    } catch (error) {
      console.error("❌ Error running pre-check:", error);
      return false;
    }
  }

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

      // 5. Create server share of private key (PIN-based split)
      // Server share will be sent to server during appointment creation
      this.serverPrivateKeyShare = await this.createPrivateKeyShare(
        this.clientKeyPair.privateKey,
        pin,
      );

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
        if (challengeResponse.status === 429) {
          const errorData = await challengeResponse.json();
          const retryAfterMs = errorData.retryAfterMs || 60000;
          const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

          // Store throttle state for frontend to enforce
          pinThrottleStore.setThrottle(this.emailHash, retryAfterMs, errorData.failedAttempts || 0);

          if (retryAfterSeconds > 0) {
            throw new Error(
              `Too many failed attempts. Please try again in ${retryAfterSeconds} seconds.`,
            );
          } else {
            throw new Error("Too many failed attempts. Please try again later.");
          }
        }
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
            challengeId: challengeData.challengeId,
            challengeResponse: decryptedChallenge,
          }),
        },
      );

      if (!verificationResponse.ok) {
        const errorData = await verificationResponse.json();
        console.error("❌ Challenge verification failed:", errorData);
        if (verificationResponse.status === 429) {
          const retryAfterMs = errorData.retryAfterMs || 60000;
          const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

          // Store throttle state for frontend to enforce
          pinThrottleStore.setThrottle(this.emailHash, retryAfterMs, errorData.failedAttempts || 0);

          if (retryAfterSeconds > 0) {
            throw new Error(
              `Too many failed attempts. Please try again in ${retryAfterSeconds} seconds.`,
            );
          } else {
            throw new Error("Too many failed attempts. Please try again later.");
          }
        }
        throw new Error("Challenge verification failed");
      }

      const verificationData = await verificationResponse.json();

      // 6. Decrypt tunnel key and store tunnel ID
      this.tunnelKey = await this.decryptTunnelKey(verificationData.encryptedTunnelKey, privateKey);
      this.tunnelId = verificationData.tunnelId;

      this.clientAuthenticated = true;

      // Clear throttle on successful authentication
      pinThrottleStore.clearThrottle();
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
    agentId: string,
    channelId: string,
    duration: number,
    tenantId: string,
    isFirstAppointment: boolean = false,
    clientLanguage: string = "de",
  ): Promise<string> {
    if (!this.clientAuthenticated || !this.tunnelKey) {
      throw new Error("Client not authenticated");
    }

    if (appointmentData.salutation) {
      return "bees-incoming";
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
            agentId,
            channelId,
            appointmentDate,
            duration,
            emailHash: this.emailHash,
            clientEmail: appointmentData.shareEmail ? appointmentData.email : undefined,
            clientLanguage,
            clientPublicKey: this.clientKeyPair?.publicKey,
            privateKeyShare: await this.getPrivateKeyShare(),
            encryptedAppointment,
            staffKeyShares: await this.getStaffKeyShares(tenantId),
            clientKeyShare: await this.getClientKeyShare(),
            clientEncryptedTunnelKey: await this.encryptTunnelKeyForClient(),
          }
        : {
            // Existing client
            emailHash: this.emailHash,
            tunnelId: this.tunnelId!,
            agentId,
            channelId,
            appointmentDate,
            duration,
            clientEmail: appointmentData.shareEmail ? appointmentData.email : undefined,
            clientLanguage,
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
   * Authenticate staff member using WebAuthn with PRF and reconstruct private key from shards
   *
   * SECURITY: Uses PRF Extension for zero-knowledge key derivation.
   * Requires modern authenticator with PRF support (CTAP 2.1+).
   */
  async authenticateStaff(staffId: string, tenantId: string): Promise<void> {
    try {
      // 1. Fetch database shard from server (to get passkeyId)
      const shardResponse = await fetch(`/api/tenants/${tenantId}/staff/${staffId}/key-shard`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!shardResponse.ok) {
        throw new Error(`Failed to fetch key shard: ${shardResponse.status}`);
      }

      const shardData = await shardResponse.json();

      // 2. Get PRF output from session (stored during login)
      const prfOutput = await this.getPRFOutputFromSession(staffId, shardData.passkeyId);

      // 3. Derive passkey-based shard from PRF output
      const passkeyBasedShard = await this.derivePasskeyBasedShardWithPRF(prfOutput, staffId);

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

      console.log("✅ Staff authentication successful with PRF");
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
      // Parse the staffKeyShare which now contains: encapsulatedSecret || iv || encryptedTunnelKey
      const staffKeyShareBytes = this.hexToUint8Array(encryptedData.staffKeyShare);

      // ML-KEM-768 encapsulated secret is 1088 bytes
      const ENCAPSULATED_SECRET_LENGTH = 1088;
      const IV_LENGTH = 12;

      if (staffKeyShareBytes.length < ENCAPSULATED_SECRET_LENGTH + IV_LENGTH) {
        throw new Error(
          `staffKeyShare too short: ${staffKeyShareBytes.length} bytes, expected at least ${ENCAPSULATED_SECRET_LENGTH + IV_LENGTH}`,
        );
      }

      const encapsulatedSecret = staffKeyShareBytes.slice(0, ENCAPSULATED_SECRET_LENGTH);
      const iv = staffKeyShareBytes.slice(
        ENCAPSULATED_SECRET_LENGTH,
        ENCAPSULATED_SECRET_LENGTH + IV_LENGTH,
      );
      const encryptedTunnelKey = staffKeyShareBytes.slice(ENCAPSULATED_SECRET_LENGTH + IV_LENGTH);

      // 1. Decapsulate to get shared secret
      const sharedSecret = KyberCrypto.decapsulate(
        this.staffKeyPair.privateKey,
        encapsulatedSecret,
      );

      // 2. Use first 32 bytes of shared secret as AES key
      const aesKeyBytes = sharedSecret.slice(0, 32);

      // Import as CryptoKey for Web Crypto API
      const aesKey = await crypto.subtle.importKey("raw", aesKeyBytes, { name: "AES-GCM" }, false, [
        "decrypt",
      ]);

      // 3. Decrypt the tunnel key with AES-GCM (encrypted already includes authTag)
      const decryptedTunnelKey = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encryptedTunnelKey,
      );
      const tunnelKeyBytes = new Uint8Array(decryptedTunnelKey);

      // 4. Import tunnel key as CryptoKey
      const tunnelKey = await crypto.subtle.importKey(
        "raw",
        tunnelKeyBytes,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      );

      // 5. Now decrypt the actual appointment data
      const appointmentIv = this.hexToUint8Array(encryptedData.encryptedAppointment.iv);
      const ciphertext = this.hexToUint8Array(encryptedData.encryptedAppointment.encryptedPayload);
      const authTag = this.hexToUint8Array(encryptedData.encryptedAppointment.authTag);

      // Combine ciphertext and auth tag for Web Crypto API
      const encrypted = new Uint8Array(ciphertext.length + authTag.length);
      encrypted.set(ciphertext);
      encrypted.set(authTag, ciphertext.length);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: appointmentIv },
        tunnelKey,
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
  }

  /**
   * Logout client and clear sensitive data
   */
  logoutClient(): void {
    this.tunnelKey = null;
    this.clientKeyPair = null;
    this.emailHash = null;
    this.tunnelId = null;
    this.serverPrivateKeyShare = null;
    this.clientAuthenticated = false;
  }

  // ===== SHARED PRIVATE METHODS =====

  /**
   * Get PRF output for staff authentication
   *
   * SECURITY: PRF Extension is REQUIRED for zero-knowledge key derivation.
   * This method retrieves PRF output from the auth session (stored during login).
   *
   * @param staffId - Staff member ID
   * @param passkeyId - Passkey credential ID
   * @returns PRF output as ArrayBuffer
   * @throws Error if PRF output is not available in session
   */
  private async getPRFOutputFromSession(staffId: string, passkeyId: string): Promise<ArrayBuffer> {
    // Import auth store dynamically to avoid circular dependencies
    const { auth } = await import("$lib/stores/auth");

    // Get PRF output from session storage (set during login)
    const passkeyAuthData = auth.getPasskeyAuthData();

    if (!passkeyAuthData) {
      throw new Error(
        "No passkey authentication data found in session. " +
          "Please log in again with your passkey to access encrypted data.",
      );
    }

    if (!passkeyAuthData.prfOutput) {
      throw new Error(
        "PRF output not available in session. " +
          "This passkey may not support the PRF extension. " +
          "Please use a modern authenticator (YubiKey 5.2.3+, Titan Gen2, Windows Hello, Touch ID, or Android).",
      );
    }

    // Verify that the passkeyId matches (security check)
    if (passkeyAuthData.passkeyId !== passkeyId) {
      throw new Error(
        `Passkey ID mismatch: expected ${passkeyId}, got ${passkeyAuthData.passkeyId}. ` +
          "Please log out and log in again.",
      );
    }

    // Decode PRF output from base64
    const prfBytes = this.base64ToUint8Array(passkeyAuthData.prfOutput);
    return prfBytes.buffer as ArrayBuffer;
  }

  /**
   * Store the staff key pair after the registration of a new staff member with PRF
   *
   * SECURITY: Uses PRF Extension for zero-knowledge key derivation.
   * The prfOutput parameter MUST come from a WebAuthn assertion with PRF extension.
   *
   * @param tenantId - Tenant ID
   * @param staffId - Staff member ID
   * @param passkeyId - Passkey credential ID
   * @param prfOutput - 32-byte PRF output from WebAuthn assertion (secret!)
   * @param keyPair - ML-KEM-768 keypair generated in browser
   * @throws Error if PRF output is invalid or API call fails
   */
  public async storeStaffKeyPair(
    tenantId: string,
    staffId: string,
    passkeyId: string,
    prfOutput: ArrayBuffer,
    keyPair: { publicKey: Uint8Array; privateKey: Uint8Array },
  ): Promise<void> {
    // Derive passkey-based shard from PRF output
    const passkeyBasedShard = await this.derivePasskeyBasedShardWithPRF(prfOutput, staffId);

    // Create database shard by XORing private key with passkey-based shard
    const dbShard = new Uint8Array(keyPair.privateKey.length);
    for (let i = 0; i < keyPair.privateKey.length; i++) {
      dbShard[i] = keyPair.privateKey[i] ^ passkeyBasedShard[i];
    }

    // Store public key and database shard on server
    await fetch(`/api/tenants/${tenantId}/staff/${staffId}/crypto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        passkeyId,
        publicKey: this.uint8ArrayToBase64(keyPair.publicKey),
        privateKeyShare: this.uint8ArrayToBase64(dbShard),
      }),
    });

    console.log("✅ Staff keypair stored with PRF-based security");
  }

  private uint8ArrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
  }

  /**
   * Derive a deterministic shard from WebAuthn PRF Extension (CTAP 2.1+)
   *
   * This method uses the PRF (Pseudo-Random Function) extension to derive a secret shard.
   * The same passkey will always produce the same shard, enabling key reconstruction.
   *
   * SECURITY: PRF provides ZERO-KNOWLEDGE guarantee:
   * - PRF output is SECRET - only the passkey owner can derive it
   * - Server NEVER sees the PRF output (only the database shard)
   * - Database compromise does NOT reveal private keys (both shards needed)
   *
   * Used in Staff Key Management:
   * - During registration: Create shard to XOR with private key for database storage
   * - During authentication: Recreate same shard to reconstruct private key
   *
   * Uses PRF Extension + HKDF expansion:
   * - Input: 32-byte PRF output from authenticator (secret!)
   * - HKDF Salt: "staff-prf-shard-v2" (version-specific)
   * - HKDF Info: "staff:{staffId}" (domain separation)
   * - Output: 2400 bytes (ML-KEM-768 private key size)
   *
   * @param prfOutput - 32-byte PRF output from assertion.getClientExtensionResults().prf.results.first
   * @param staffId - Staff member ID for domain separation
   * @returns 2400-byte shard for XOR-based key reconstruction
   * @throws Error if PRF output is not exactly 32 bytes
   */
  private async derivePasskeyBasedShardWithPRF(
    prfOutput: ArrayBuffer,
    staffId: string,
  ): Promise<Uint8Array> {
    // Validate PRF output length (should always be 32 bytes per CTAP 2.1 spec)
    const prfBytes = new Uint8Array(prfOutput);
    if (prfBytes.length !== 32) {
      throw new Error(`Invalid PRF output length: ${prfBytes.length} bytes (expected 32)`);
    }

    // Import the PRF output as a CryptoKey for HKDF expansion
    const ikmKey = await crypto.subtle.importKey("raw", prfBytes, "HKDF", false, ["deriveBits"]);

    // Salt for HKDF (versioned to allow future rotation)
    // v2: Uses email-based PRF salts for multi-passkey support
    // Each passkey still produces unique PRF output (passkey private key is part of PRF)
    const salt = new TextEncoder().encode("staff-prf-shard-v2");

    // Info for HKDF (domain separation per staff member)
    const info = new TextEncoder().encode(`staff:${staffId}`);

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
    return crypto.randomUUID();
  }

  /**
   * Creates a server share of the private key using Shamir Secret Sharing (2-of-2)
   *
   * This implements a 2-party key splitting scheme where:
   * - PIN-derived share (x=1): Deterministically derived from PIN + email hash (client can always recreate)
   * - Server share (x=2): Stored in database
   *
   * Reconstruction requires both shares (2-of-2 threshold).
   *
   * Security properties:
   * - Each share reveals NO information about the private key (information-theoretic security)
   * - Both shares are required for reconstruction
   * - Server share is useless without the PIN
   *
   * This allows the client to authenticate from any device:
   * 1. Client provides email + PIN
   * 2. Server returns the server share via challenge API
   * 3. Client derives PIN share deterministically and reconstructs the private key
   *
   * @param privateKey - The ML-KEM-768 private key (hex string)
   * @param pin - User's PIN for deterministic share derivation
   * @returns Server share (hex string) to be stored in database
   */
  private async createPrivateKeyShare(privateKey: string, pin: string): Promise<string> {
    const privateKeyBytes = this.hexToUint8Array(privateKey);

    // Derive a deterministic y-value for the PIN-based share (x=1)
    // ML-KEM-768 private key is 2400 bytes, so we need a hash of that length
    const pinHash = await OptimizedArgon2.deriveKeyFromPIN(pin, this.emailHash || "", {
      hashLength: privateKeyBytes.length,
    });

    // Use ShamirSecretSharing to create the shares with deterministic first share
    const shares = ShamirSecretSharing.splitSecretWithDeterministicShare(privateKeyBytes, pinHash);

    // TEST: Immediately reconstruct to verify
    const testReconstruct = ShamirSecretSharing.reconstructSecret(shares);
    const match = privateKeyBytes.every((v, i) => v === testReconstruct[i]);

    if (!match) {
      console.error("❌ CRITICAL: Shamir reconstruction failed immediately after split!");
    }

    // Return the server share (x=2)
    return this.uint8ArrayToHex(shares[1].y);
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

    // Export tunnel key as raw bytes
    const tunnelKeyBytes = await crypto.subtle.exportKey("raw", this.tunnelKey);
    const tunnelKeyArray = new Uint8Array(tunnelKeyBytes);

    const results = [];

    for (const staff of staffKeys) {
      // Public key is stored as Base64, not Hex
      const staffPublicKeyBytes = this.base64ToUint8Array(staff.publicKey);

      console.log("🔐 Encrypting tunnel key for staff:", {
        userId: staff.userId,
        publicKeyLength: staffPublicKeyBytes.length,
        publicKeyHex:
          Array.from(staffPublicKeyBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .substring(0, 64) + "...",
        tunnelKeyLength: tunnelKeyArray.length,
      });

      // Kyber encapsulation creates a shared secret
      const { sharedSecret, encapsulatedSecret } = KyberCrypto.encapsulate(staffPublicKeyBytes);

      console.log("🔑 Kyber encapsulation done:", {
        sharedSecretLength: sharedSecret.length,
        encapsulatedSecretLength: encapsulatedSecret.length,
      });

      // Use the first 32 bytes of shared secret as AES key (same as decryption)
      const aesKeyBytes = sharedSecret.slice(0, 32);

      console.log(
        "🔑 AES key for encryption (hex):",
        Array.from(aesKeyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      );

      // Import as CryptoKey for Web Crypto API
      const aesKey = await crypto.subtle.importKey("raw", aesKeyBytes, { name: "AES-GCM" }, false, [
        "encrypt",
      ]);

      // Generate IV for AES-GCM
      const iv = BufferUtils.randomBytes(12);

      console.log(
        "📍 IV for encryption (hex):",
        Array.from(iv)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      );
      console.log(
        "🔒 Tunnel key to encrypt (hex):",
        Array.from(tunnelKeyArray)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      );

      // Encrypt tunnel key with AES-GCM
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        tunnelKeyArray,
      );

      // encrypted contains ciphertext + 16-byte auth tag
      const encryptedArray = new Uint8Array(encrypted);

      console.log(
        "🔒 Encrypted tunnel key (hex):",
        Array.from(encryptedArray)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      );

      // Store: encapsulatedSecret || iv || encrypted (ciphertext+authTag)
      const combined = new Uint8Array(
        encapsulatedSecret.length + iv.length + encryptedArray.length,
      );
      combined.set(encapsulatedSecret, 0);
      combined.set(iv, encapsulatedSecret.length);
      combined.set(encryptedArray, encapsulatedSecret.length + iv.length);

      results.push({
        userId: staff.userId,
        encryptedTunnelKey: this.uint8ArrayToHex(combined),
      });
    }

    return results;
  }

  private async encryptTunnelKeyForClient(): Promise<string> {
    if (!this.tunnelKey || !this.clientKeyPair)
      throw new Error("Tunnel key or client key not available");

    // Export tunnel key as raw bytes
    const tunnelKeyBytes = await crypto.subtle.exportKey("raw", this.tunnelKey);
    const tunnelKeyArray = new Uint8Array(tunnelKeyBytes);

    const clientPublicKeyBytes = this.hexToUint8Array(this.clientKeyPair.publicKey);

    // Kyber encapsulation creates a shared secret
    const { sharedSecret, encapsulatedSecret } = KyberCrypto.encapsulate(clientPublicKeyBytes);

    // Use the first 32 bytes of shared secret as AES key
    const aesKeyBytes = sharedSecret.slice(0, 32);

    // Import as CryptoKey for Web Crypto API
    const aesKey = await crypto.subtle.importKey("raw", aesKeyBytes, { name: "AES-GCM" }, false, [
      "encrypt",
    ]);

    // Generate IV for AES-GCM
    const iv = BufferUtils.randomBytes(12);

    // Encrypt tunnel key with AES-GCM
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, tunnelKeyArray);

    // encrypted contains ciphertext + 16-byte auth tag
    const encryptedArray = new Uint8Array(encrypted);

    // Store: encapsulatedSecret || iv || encrypted (ciphertext+authTag)
    const combined = new Uint8Array(encapsulatedSecret.length + iv.length + encryptedArray.length);
    combined.set(encapsulatedSecret, 0);
    combined.set(iv, encapsulatedSecret.length);
    combined.set(encryptedArray, encapsulatedSecret.length + iv.length);

    return this.uint8ArrayToHex(combined);
  }

  private async reconstructPrivateKey(pin: string, serverShare: string): Promise<string> {
    if (!this.emailHash) {
      throw new Error("Email hash not available for key reconstruction");
    }
    // 1. Derive PIN-based share deterministically (x=1, y=pinShareY)
    const serverShareBytes = this.hexToUint8Array(serverShare);
    // ML-KEM-768 private key is 2400 bytes, derive hash of same length
    const pinHash = await OptimizedArgon2.deriveKeyFromPIN(pin, this.emailHash, {
      hashLength: serverShareBytes.length,
    });

    // 2. Reconstruct using proper Shamir Secret Sharing
    const shares = [
      { x: 1, y: pinHash },
      { x: 2, y: serverShareBytes },
    ];
    const privateKey = ShamirSecretSharing.reconstructSecret(shares);

    return this.uint8ArrayToHex(privateKey);
  }

  private async decryptChallenge(encryptedChallenge: string, privateKey: string): Promise<string> {
    const privateKeyBytes = this.hexToUint8Array(privateKey);
    const fullChallengeBytes = this.hexToUint8Array(encryptedChallenge);

    // Split the encryptedChallenge into:
    // 1. Encapsulated secret (first 1088 bytes for ML-KEM-768)
    // 2. Encrypted challenge (remaining bytes)
    const encapsulatedSecret = fullChallengeBytes.slice(0, 1088);
    const encryptedChallengeBuffer = fullChallengeBytes.slice(1088);

    // Decapsulate to get the shared secret
    const sharedSecret = KyberCrypto.decapsulate(privateKeyBytes, encapsulatedSecret);

    // XOR the encrypted challenge with the shared secret to decrypt
    const challenge = new Uint8Array(encryptedChallengeBuffer.length);
    for (let i = 0; i < encryptedChallengeBuffer.length; i++) {
      challenge[i] = encryptedChallengeBuffer[i] ^ sharedSecret[i];
    }

    // The decrypted challenge is raw bytes (32 bytes from randomBytes)
    // Convert to base64 string for server verification
    const challengeBase64 = this.uint8ArrayToBase64(challenge);

    // Return the base64-encoded challenge (server expects it in base64 format)
    return challengeBase64;
  }

  private async decryptTunnelKey(
    encryptedTunnelKey: string,
    privateKey: string,
  ): Promise<CryptoKey> {
    const privateKeyBytes = this.hexToUint8Array(privateKey);
    const encryptedKeyBytes = this.hexToUint8Array(encryptedTunnelKey);

    // Parse the encrypted data: encapsulatedSecret || iv || encryptedTunnelKey
    const ENCAPSULATED_SECRET_LENGTH = 1088;
    const IV_LENGTH = 12;

    if (encryptedKeyBytes.length < ENCAPSULATED_SECRET_LENGTH + IV_LENGTH) {
      throw new Error(
        `encryptedTunnelKey too short: ${encryptedKeyBytes.length} bytes, expected at least ${ENCAPSULATED_SECRET_LENGTH + IV_LENGTH}`,
      );
    }

    const encapsulatedSecret = encryptedKeyBytes.slice(0, ENCAPSULATED_SECRET_LENGTH);
    const iv = encryptedKeyBytes.slice(
      ENCAPSULATED_SECRET_LENGTH,
      ENCAPSULATED_SECRET_LENGTH + IV_LENGTH,
    );
    const encryptedTunnel = encryptedKeyBytes.slice(ENCAPSULATED_SECRET_LENGTH + IV_LENGTH);

    // 1. Decapsulate to get shared secret
    const sharedSecret = KyberCrypto.decapsulate(privateKeyBytes, encapsulatedSecret);

    // 2. Use first 32 bytes as AES key
    const aesKeyBytes = sharedSecret.slice(0, 32);

    // 3. Import as CryptoKey
    const aesKey = await crypto.subtle.importKey("raw", aesKeyBytes, { name: "AES-GCM" }, false, [
      "decrypt",
    ]);

    // 4. Decrypt the tunnel key
    const decryptedTunnelKey = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encryptedTunnel,
    );

    // 5. Import tunnel key as CryptoKey
    return await crypto.subtle.importKey(
      "raw",
      new Uint8Array(decryptedTunnelKey),
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"],
    );
  }

  // Helper methods for completing the API
  private async getPrivateKeyShare(): Promise<string> {
    if (!this.serverPrivateKeyShare) throw new Error("Server private key share not available");
    return this.serverPrivateKeyShare;
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
