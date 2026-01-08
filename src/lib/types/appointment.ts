// ===== CLIENT-SIDE END-TO-END ENCRYPTION TYPES =====

// Step 1: New Client - Server Preparation
export interface InitNewClientRequest {
  tunnelId: string;
  appointmentDate: string;
  emailHash: string; // SHA-256 hash of email
}

export interface InitNewClientResponse {
  staffPublicKeys: Array<{
    userId: string;
    publicKey: string; // Kyber Public Keys
  }>;
}

// Step 2: New Client - Appointment Creation
export interface CreateNewClientAppointmentRequest {
  tunnelId: string;
  appointmentDate: string;
  emailHash: string;

  // Client-generated data
  clientPublicKey: string; // Kyber Public Key
  privateKeyShare: string; // Server part of private key

  // Encrypted appointment data
  encryptedAppointment: EncryptedAppointmentData;

  // Tunnel key encrypted for each staff user
  staffKeyShares: Array<{
    userId: string;
    encryptedTunnelKey: string; // Encrypted with staff public key
  }>;

  // Tunnel key encrypted for client (for future appointments)
  clientKeyShare: string; // Encrypted with client public key
}

// Existing Client - Challenge Request
export interface ChallengeRequest {
  emailHash: string;
}

export interface ChallengeResponse {
  challengeId: string; // Unique ID to reference this challenge during verification
  encryptedChallenge: string; // Encrypted with client public key
  privateKeyShare: string; // Server part of private key
}

// Existing Client - Challenge Verification
export interface ChallengeVerificationRequest {
  challengeId: string; // ID of the challenge to verify
  challengeResponse: string; // Decrypted challenge
}

export interface ChallengeVerificationResponse {
  valid: boolean;
  encryptedTunnelKey: string; // Encrypted with client public key
  tunnelId: string; // ID of client tunnel (to save or load appointments)
}

// Existing Client - New Appointment
export interface AddAppointmentToTunnelRequest {
  emailHash: string;
  tunnelId: string;
  appointmentDate: string;
  encryptedAppointment: EncryptedAppointmentData;
}

// Encrypted appointment data (encrypted in browser)
export interface EncryptedAppointmentData {
  encryptedPayload: string; // AES-encrypted: { name, email, phone }
  iv: string;
  authTag: string;
}

// Client Appointments "Tunnel" (like an encrypted tunnel)
export interface ClientAppointmentsTunnel {
  id: string;
  clientId: string;
  tenantId: string;
  emailHash: string;

  // Encrypted appointments (list like chat messages)
  encryptedAppointments: Array<{
    id: string;
    tunnelId: string;
    appointmentDate: string;
    encryptedData: EncryptedAppointmentData;
    status: "NEW" | "CONFIRMED" | "HELD" | "REJECTED" | "NO_SHOW";
    createdAt: string;
  }>;

  // Tunnel key encrypted for all authorized parties
  keyShares: {
    clientKeyShare: string; // Encrypted with client public key
    staffKeyShares: Array<{
      userId: string;
      encryptedKey: string; // Encrypted with staff public key
    }>;
  };
}

// Responses
export interface AppointmentResponse {
  id: string;
  appointmentDate: string;
  status: "NEW" | "CONFIRMED" | "HELD" | "REJECTED" | "NO_SHOW";
  requiresConfirmation?: boolean;
}
