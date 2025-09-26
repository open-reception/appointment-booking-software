# Client-Side End-to-End Encryption for Appointment Bookings

## Overview

This document describes the revised concept for end-to-end encrypted appointment bookings with client-side encryption. The system implements a zero-knowledge architecture where the server never has access to unencrypted personal data.

## Security Principles

1. **Zero-Knowledge Server**: Server never sees plaintext data
2. **Client-Side Encryption**: All crypto operations in the browser
3. **PIN stays secret**: PIN never leaves the client
4. **Challenge-Response**: Secure authentication without PIN transmission
5. **Post-Quantum Cryptography**: ML-KEM-768 (Kyber) for key exchange
6. **ClientAppointments Tunnel**: Scalable appointment encryption like chat channels

## Architecture Components

### 1. ClientAppointments Tunnel Concept

Each client has an encrypted "tunnel" with all their appointments for a tenant:

```
ClientAppointmentsTunnel:
├── Encrypted Appointments (List)
├── Tunnel Key (AES-256)
├── Client Key Share (PIN-derived)
└── Staff Key Shares (Kyber-encrypted)
```

### 2. Cryptographic Primitives

- **ML-KEM-768 (Kyber)**: Post-Quantum Key Exchange (encrypts the tunnel key)
- **AES-256-GCM**: Symmetric encryption of appointment data (encryption unique per tunnel)
- **Shamir Secret Sharing**: Private Key Split (2-of-2)
- **Argon2**: PIN-based key derivation
- **Challenge-Response**: Secure authentication for clients (based on the PIN)

## Flow Diagrams

### Flow 1: New Client

```mermaid
sequenceDiagram
    participant C as Client (Browser)
    participant S as Server

    Note over C,S: Step 1: Initialization
    C->>S: GET /api/appointments/staff-public-keys?tenantId=xxx
    Note right of C: Get staff public keys for encryption

    S->>S: Get staff public keys for tenant
    S->>C: 200 Staff Public Keys
    Note left of S: { staffPublicKeys: [{ userId, publicKey }] }

    Note over C,S: Step 2: Client-Side Encryption
    C->>C: Enter PIN
    C->>C: Generate tunnel key (AES-256)
    C->>C: Encrypt appointment data with tunnel key
    C->>C: Generate client keypair (Kyber)
    C->>C: Split private key with PIN (Shamir 2-of-2)
    C->>C: Encrypt tunnel key for each staff member

    Note over C,S: Step 3: Encrypted Transmission
    C->>S: POST /api/appointments/create
    Note right of C: {<br/>  encryptedAppointment,<br/>  staffKeyShares,<br/>  clientPublicKey,<br/>  privateKeyShare,<br/>  clientKeyShare<br/>}

    S->>S: Store encrypted data
    S->>S: Create ClientAppointments Tunnel
    S->>C: 201 Success
    Note left of S: { appointmentId, appointmentDate, status }
```

### Flow 2: Existing Client

```mermaid
sequenceDiagram
    participant C as Client (Browser)
    participant S as Server

    Note over C,S: Step 1: Challenge-Response Authentication
    C->>S: POST /api/appointments/challenge
    Note right of C: { emailHash }

    S->>S: Generate challenge (UUID)
    S->>S: Encrypt challenge with client public key
    S->>C: 200 Challenge + Private Key Share
    Note left of S: {<br/>  challenge,<br/>  encryptedChallenge,<br/>  privateKeyShare<br/>}

    Note over C,S: Step 2: Client-Side Challenge Solution
    C->>C: Enter PIN
    C->>C: Reconstruct private key (PIN + privateKeyShare)
    C->>C: Decrypt challenge with private key

    C->>S: POST /api/appointments/verify-challenge
    Note right of C: { emailHash, challengeResponse }

    S->>S: Verify challenge response
    alt Challenge correct
        S->>S: Get staff public keys + tunnel
        S->>C: 200 Authenticated
        Note left of S: {<br/>  staffPublicKeys,<br/>  encryptedTunnelKey<br/>}
    else Challenge incorrect
        S->>C: 401 Unauthorized
    end

    Note over C,S: Step 3: Add new appointment
    C->>C: Decrypt tunnel key with private key
    C->>C: Encrypt new appointment with tunnel key

    C->>S: POST add-to-tunnel
    Note right of C: {<br/>  emailHash,<br/>  tunnelId,<br/>  appointmentDate,<br/>  encryptedAppointment<br/>}

    S->>S: Add to ClientAppointments Tunnel
    S->>C: 201 Success
```

### Flow 3: Client loads an apppointment

```mermaid
sequenceDiagram
    participant C as Client (Browser)
    participant S as Server

    Note over C,S: Authentication (like Flow 2, Steps 1-2)
    C->>S: Challenge-Response Authentication
    S->>C: Authenticated + Tunnel Access

    Note over C,S: Load and decrypt appointment
    C->>S: GET appointments/(id)
    S->>S: Get encrypted appointment for client
    S->>C: 200 Encrypted appointment
    Note left of S: {<br/>  appointments: [{<br/>    id, appointmentDate, status,<br/>    encryptedData: { encryptedPayload, iv, authTag }<br/>  }],<br/>  encryptedTunnelKey<br/>}

    Note over C,S: Client-Side Decryption
    C->>C: Decrypt tunnel key with private key
    C->>C: Decrypt each appointment with tunnel key
    C->>C: Display decrypted appointments in UI
```

## Security Considerations

### What the server never sees:

- ✅ Client's PIN
- ✅ Plaintext names, email, phone
- ✅ Complete private key
- ✅ Tunnel key in plaintext

### What the server sees:

- ✅ Email hash (for client identification)
- ✅ Appointment date and time
- ✅ Tunnel ID (public)
- ✅ Encrypted payloads
- ✅ Appointment status

### Attack vectors and countermeasures:

1. **Server compromise**: Server cannot decrypt encrypted data
2. **Man-in-the-Middle**: HTTPS + Key-Pinning can protect transmission
3. **Brute-Force PIN**: Argon2 + Client-Side Rate-Limiting
4. **Timing attacks**: Constant response times for challenge-response
5. **Side-Channel**: All crypto operations in Web Crypto API

## Performance Considerations

### Client-Side:

- Kyber Key Generation: ~10ms
- AES Encryption: <1ms per appointment
- Challenge-Response: <5ms
- **Total time new client**: ~50ms
- **Total time existing client**: ~20ms

### Server-Side:

- No crypto operations
- Only database I/O
- **Highly scalable** due to stateless design
