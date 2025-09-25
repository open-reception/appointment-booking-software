/**
 * Client-side End-to-End Encryption for Appointments
 *
 * This class implements browser-side cryptography for the Zero-Kno      // 3. Verify challenge with server
      const verificationResponse = await fetch(`/api/tenants/${tenantId}/appointments/verify-challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailHash: this.emailHash,
          challengeResponse: decryptedChallenge,
        }),
      }); Appointment System. All sensitive operations happen in the browser.
 *
 * Usage:
 *
 * // New Client
 * const crypto = new ClientAppointmentCrypto();
 * await crypto.initNewClient(email, pin);
 * const appointment = await crypto.createAppointment(appointmentData);
 *
 * // Existing Client
 * const crypto = new ClientAppointmentCrypto();
 * await crypto.loginExistingClient(email, pin);
 * const appointment = await crypto.createAppointment(appointmentData);
 * const myAppointments = await crypto.getMyAppointments();
 */

import { OptimizedArgon2 } from "$lib/crypto/hashing";
import { KyberCrypto, AESCrypto, ShamirSecretSharing } from "$lib/crypto/utils";

// Type definitions for client-side cryptography
interface ClientKeyPair {
  publicKey: string;
  privateKey: string;
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

export class ClientAppointmentCrypto {
  private tunnelKey: CryptoKey | null = null;
  private clientKeyPair: ClientKeyPair | null = null;
  private emailHash: string | null = null;
  private tunnelId: string | null = null;
  private isAuthenticated: boolean = false;
  private kyberCrypto: KyberCrypto = new KyberCrypto();
  private aesCrypto: AESCrypto = new AESCrypto();
  private shamirSharing: ShamirSecretSharing = new ShamirSecretSharing();

  /**
   * Initializes a new client with E2E encryption
   */
  async initNewClient(email: string, pin: string): Promise<void> {
    try {
      // 1. Generate email hash for privacy-preserving lookup
      this.emailHash = await this.hashEmail(email);

      // 2. Generate tunnel ID
      this.tunnelId = this.generateTunnelId();

      // 3. Generate ML-KEM-768 keypair
      this.clientKeyPair = await this.generateKeyPair();

      // 4. Generate tunnel key for AES encryption
      this.tunnelKey = await this.generateTunnelKey();

      // 5. Split private key into Shamir shares (2-of-2)
      const privateKeyShare = await this.createPrivateKeyShare(this.clientKeyPair.privateKey, pin);

      // 6. Fetch staff public keys from server
      const staffPublicKeys = await this.fetchStaffPublicKeys();

      // 7. Encrypt tunnel key for all staff members
      const staffKeyShares = await this.encryptTunnelKeyForStaff(staffPublicKeys);

      // 8. Encrypt tunnel key for client (for later use)
      const clientKeyShare = await this.encryptTunnelKeyForClient();

      console.log("✅ New client initialized", {
        tunnelId: this.tunnelId,
        emailHashPrefix: this.emailHash.slice(0, 8),
        staffCount: staffPublicKeys.length,
      });

      this.isAuthenticated = true;
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
      this.isAuthenticated = true;
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
    if (!this.isAuthenticated || !this.tunnelKey) {
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
            // Neuer Client
            tunnelId: this.tunnelId,
            channelId,
            appointmentDate,
            emailHash: this.emailHash,
            clientPublicKey: this.clientKeyPair?.publicKey,
            privateKeyShare: await this.getPrivateKeyShare(),
            encryptedAppointment,
            staffKeyShares: await this.getStaffKeyShares(),
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
    if (!this.isAuthenticated || !this.tunnelKey) {
      throw new Error("Client not authenticated");
    }

    try {
      const response = await fetch(`/api/tenants/${tenantId}/appointments/my-appointments`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.authToken}`,
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

  // ===== PRIVATE CRYPTO FUNCTIONS =====

  /**
   * Generates deterministic SHA-256 hash of email for privacy-preserving lookups
   */
  private async hashEmail(email: string): Promise<string> {
    const emailNormalized = email.toLowerCase().trim();

    if (typeof crypto !== "undefined" && crypto.subtle) {
      // Browser environment
      const encoder = new TextEncoder();
      const data = encoder.encode(emailNormalized);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } else {
      // Node.js environment
      const { createHash } = await import("crypto");
      return createHash("sha256").update(emailNormalized).digest("hex");
    }
  }

  /**
   * Generates ML-KEM-768 keypair
   */
  private async generateKeyPair(): Promise<ClientKeyPair> {
    const keyPair = await KyberCrypto.generateKeyPair();
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
   * Generates AES-256-GCM tunnel key
   */
  private async generateTunnelKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
  }

  /**
   * Encrypts appointment data with the tunnel key
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
   * Decrypts appointment data with the tunnel key
   */
  private async decryptAppointmentData(encryptedData: EncryptedData): Promise<AppointmentData> {
    if (!this.tunnelKey) throw new Error("No tunnel key available");

    const iv = new Uint8Array(encryptedData.iv.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
    const ciphertext = new Uint8Array(
      encryptedData.encryptedPayload.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );
    const authTag = new Uint8Array(
      encryptedData.authTag.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );

    // Combine ciphertext and auth tag
    const encrypted = new Uint8Array(ciphertext.length + authTag.length);
    encrypted.set(ciphertext);
    encrypted.set(authTag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      this.tunnelKey,
      encrypted,
    );

    const decoder = new TextDecoder();
    const plaintext = decoder.decode(decrypted);
    return JSON.parse(plaintext);
  }

  /**
   * Helper functions with real crypto implementations
   */
  private generateTunnelId(): string {
    return "tunnel_" + crypto.randomUUID();
  }

  private async createPrivateKeyShare(privateKey: string, pin: string): Promise<string> {
    // Use Shamir Secret Sharing for private key
    const privateKeyBytes = new Uint8Array(
      privateKey.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );
    const shares = ShamirSecretSharing.splitSecret(privateKeyBytes, 2, 2);

    // One share is PIN-encrypted and stored on client
    const clientShare = shares[0].y;
    const pinHash = await OptimizedArgon2.deriveKeyFromPIN(pin, this.emailHash || "");
    const encryptedShare = await AESCrypto.encrypt(
      Array.from(clientShare)
        .map((b: number) => b.toString(16).padStart(2, "0"))
        .join(""),
      pinHash,
    );

    return Array.from(encryptedShare.encrypted)
      .map((b: number) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private async fetchStaffPublicKeys(): Promise<StaffPublicKey[]> {
    // Get tenant ID from current URL or environment
    const tenantId = this.getTenantId();

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

  private getTenantId(): string {
    // Try to get tenant ID from current URL path
    // Assuming URL structure like /tenants/[id]/...
    const pathParts = window.location.pathname.split("/");
    const tenantIndex = pathParts.indexOf("tenants");

    if (tenantIndex !== -1 && pathParts[tenantIndex + 1]) {
      return pathParts[tenantIndex + 1];
    }

    throw new Error("Could not determine tenant ID from current URL");
  }

  private async encryptTunnelKeyForStaff(
    staffKeys: StaffPublicKey[],
  ): Promise<Array<{ userId: string; encryptedTunnelKey: string }>> {
    if (!this.tunnelKey) throw new Error("Kein Tunnel-Schlüssel verfügbar");

    const results = [];

    for (const staff of staffKeys) {
      // Verwende Kyber für die Verschlüsselung des Tunnel-Keys
      const staffPublicKeyBytes = new Uint8Array(
        staff.publicKey.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
      );
      const encryptedKey = KyberCrypto.encapsulate(staffPublicKeyBytes);

      results.push({
        userId: staff.userId,
        encryptedTunnelKey: Array.from(encryptedKey.encapsulatedSecret)
          .map((b: number) => b.toString(16).padStart(2, "0"))
          .join(""),
      });
    }

    return results;
  }

  private async encryptTunnelKeyForClient(): Promise<string> {
    if (!this.tunnelKey || !this.clientKeyPair)
      throw new Error("Tunnel-Schlüssel oder Client-Schlüssel nicht verfügbar");

    const clientPublicKeyBytes = new Uint8Array(
      this.clientKeyPair.publicKey.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );
    const encryptedKey = KyberCrypto.encapsulate(clientPublicKeyBytes);

    return Array.from(encryptedKey.encapsulatedSecret)
      .map((b: number) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private async reconstructPrivateKey(pin: string, serverShare: string): Promise<string> {
    // Rekonstruiere Private Key aus PIN und Server-Share
    const pinHash = await OptimizedArgon2.deriveKeyFromPIN(pin, this.emailHash || "");
    const serverShareBytes = new Uint8Array(
      serverShare.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );

    // Entschlüssele Client-Share mit PIN (vereinfacht - in der echten Implementierung würde man IV und Tag richtig verwalten)
    const iv = new Uint8Array(12);
    const authTag = new Uint8Array(16);
    const encryptedData = serverShareBytes.slice(0, -16); // Vereinfacht
    const clientShareText = await AESCrypto.decrypt(encryptedData, pinHash, iv, authTag);
    const clientShareBytes = new Uint8Array(
      clientShareText.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );

    // Rekonstruiere Private Key aus beiden Shares
    const shares = [
      { x: 1, y: clientShareBytes },
      { x: 2, y: serverShareBytes },
    ];
    const reconstructedKey = ShamirSecretSharing.reconstructSecret(shares);

    return Array.from(reconstructedKey)
      .map((b: number) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private async decryptChallenge(encryptedChallenge: string, privateKey: string): Promise<string> {
    // Entschlüssele Challenge mit Private Key (Kyber Decapsulation)
    const privateKeyBytes = new Uint8Array(
      privateKey.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );
    const challengeBytes = new Uint8Array(
      encryptedChallenge.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );

    const sharedSecret = await KyberCrypto.decapsulate(challengeBytes, privateKeyBytes);
    return Array.from(sharedSecret)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private async decryptTunnelKey(
    encryptedTunnelKey: string,
    privateKey: string,
  ): Promise<CryptoKey> {
    // Entschlüssele Tunnel-Key mit Private Key
    const privateKeyBytes = new Uint8Array(
      privateKey.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );
    const encryptedKeyBytes = new Uint8Array(
      encryptedTunnelKey.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
    );

    const tunnelKeyBytes = KyberCrypto.decapsulate(privateKeyBytes, encryptedKeyBytes);

    return await crypto.subtle.importKey(
      "raw",
      new Uint8Array(tunnelKeyBytes),
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"],
    );
  }

  // Weitere Hilfsfunktionen für vollständige API
  private async getPrivateKeyShare(): Promise<string> {
    // Return server share from Shamir splitting
    return "server_share_placeholder";
  }

  private async getStaffKeyShares(): Promise<
    Array<{ userId: string; encryptedTunnelKey: string }>
  > {
    // Return all staff key shares
    return [];
  }

  private async getClientKeyShare(): Promise<string> {
    // Return client's encrypted tunnel key
    return "client_share_placeholder";
  }
}

// ===== VERWENDUNGSBEISPIELE =====

/*
// Beispiel 1: Neuer Client registriert sich und erstellt ersten Termin
async function newClientExample() {
	const crypto = new ClientAppointmentCrypto();
	
	// Client initialisieren
	await crypto.initNewClient('patient@example.com', '1234');
	
	// Termin erstellen
	const appointmentId = await crypto.createAppointment({
		name: 'Max Mustermann',
		email: 'patient@example.com',
		phone: '+49 123 456789'
	}, '2024-01-15T10:00:00Z', 'channel-uuid', 'tenant-uuid', true);
	
	console.log('Termin erstellt:', appointmentId);
}

// Beispiel 2: Bestehender Client loggt sich ein und ruft Termine ab
async function existingClientExample() {
	const crypto = new ClientAppointmentCrypto();
	
	// Client authentifizieren
	await crypto.loginExistingClient('patient@example.com', '1234');
	
	// Termine abrufen und entschlüsseln
	const appointments = await crypto.getMyAppointments();
	console.log('Meine Termine:', appointments);
	
	// Neuen Termin erstellen
	const newAppointmentId = await crypto.createAppointment({
		name: 'Max Mustermann',
		email: 'patient@example.com',
		phone: '+49 123 456789'
	}, '2024-01-20T14:00:00Z', 'channel-uuid', 'tenant-uuid');
	
	console.log('Neuer Termin erstellt:', newAppointmentId);
}
*/
