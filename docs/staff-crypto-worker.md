# Staff Crypto Management Documentation

## Overview

The Staff Crypto system implements browser-based end-to-end encryption for staff members accessing patient appointment data. All cryptographic operations happen in the browser using WebAuthn-backed key derivation with split-key architecture for maximum security.

## Architecture

```
Browser (Staff App) ↔ StaffCryptoService API ↔ Tenant Database
       ↓
   WebAuthn Passkeys ↔ Hardware Keys
```

- **Browser**: Generates Kyber keys, performs encryption/decryption
- **StaffCryptoService**: Stores/retrieves key shards and public keys
- **WebAuthn**: Hardware-backed authentication for deterministic key derivation
- **Split-Key Storage**: Private keys split between database and passkey-derived shards

## Key Features

- **Browser-Based Cryptography**: All key generation and crypto operations in browser
- **Split-Key Architecture**: Private keys split using XOR between database and passkey shards
- **WebAuthn Integration**: Hardware-backed deterministic key derivation from passkey data
- **Zero-Knowledge Server**: Server never sees complete private keys
- **Per-Passkey Keys**: Each staff passkey has its own unique keypair
- **ML-KEM-768 Encryption**: Post-quantum cryptography using Kyber

## Browser Integration Workflow

### 1. Staff Passkey Registration & Key Generation

When a staff member registers a new passkey, the browser automatically generates crypto keys:

```javascript
import { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";

async function registerStaffPasskey(userId, tenantId) {
  // 1. Complete WebAuthn passkey registration
  const credential = await navigator.credentials.create({
    publicKey: registrationOptions,
  });

  // 2. Generate Kyber keypair in browser
  const keyPair = KyberCrypto.generateKeyPair();

  // 3. Derive deterministic shard from WebAuthn authenticatorData
  const crypto = new UnifiedAppointmentCrypto();
  const passkeyBasedShard = await crypto.derivePasskeyBasedShard(
    credential.id,
    credential.response.authenticatorData,
  );

  // 4. Create database shard using XOR
  const dbShard = new Uint8Array(keyPair.privateKey.length);
  for (let i = 0; i < keyPair.privateKey.length; i++) {
    dbShard[i] = keyPair.privateKey[i] ^ passkeyBasedShard[i];
  }

  // 5. Store via StaffCryptoService API
  await fetch(`/api/tenants/${tenantId}/staff/${userId}/crypto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      passkeyId: credential.id,
      publicKey: bufferToBase64(keyPair.publicKey),
      privateKeyShare: bufferToBase64(dbShard),
    }),
  });

  console.log("Staff crypto keys generated and stored");
}
```

### 2. Staff Authentication & Key Reconstruction

When a staff member authenticates, their private key is reconstructed from shards:

```javascript
async function authenticateStaff(userId, tenantId) {
  // 1. Perform WebAuthn authentication
  const assertion = await navigator.credentials.get({
    publicKey: authenticationOptions,
  });

  // 2. Get database shard from API
  const response = await fetch(`/api/tenants/${tenantId}/staff/${userId}/key-shard`);
  const { publicKey, privateKeyShare, passkeyId } = await response.json();

  // 3. Derive same passkey-based shard
  const crypto = new UnifiedAppointmentCrypto();
  const passkeyBasedShard = await crypto.derivePasskeyBasedShard(
    passkeyId,
    assertion.response.authenticatorData,
  );

  // 4. Reconstruct private key using XOR
  const dbShard = base64ToBuffer(privateKeyShare);
  const privateKey = new Uint8Array(dbShard.length);
  for (let i = 0; i < dbShard.length; i++) {
    privateKey[i] = dbShard[i] ^ passkeyBasedShard[i];
  }

  // 5. Store reconstructed keypair for session
  crypto.staffKeyPair = {
    publicKey: base64ToBuffer(publicKey),
    privateKey: privateKey,
  };

  console.log("Staff authenticated and keys reconstructed");
  return crypto;
}
```

## StaffCryptoService API

The backend API provides these endpoints for managing staff cryptographic keys:

### Store Staff Keypair

```
POST /api/tenants/{tenantId}/staff/{userId}/crypto
```

**Body:**

```json
{
  "passkeyId": "credential-id-from-webauthn",
  "publicKey": "base64-encoded-kyber-public-key",
  "privateKeyShare": "base64-encoded-database-shard"
}
```

### Get Staff Key Shard

```
GET /api/tenants/{tenantId}/staff/{userId}/key-shard
```

**Response:**

```json
{
  "publicKey": "base64-encoded-kyber-public-key",
  "privateKeyShare": "base64-encoded-database-shard",
  "passkeyId": "associated-passkey-id"
}
```

### Get All Staff Public Keys

```
GET /api/tenants/{tenantId}/appointments/staff-public-keys
```

**Response:**

```json
{
  "staffPublicKeys": [
    {
      "userId": "staff-user-id",
      "publicKey": "base64-encoded-kyber-public-key"
    }
  ]
}
```

## Browser Implementation

### Initialize Crypto System

```javascript
import { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";

const crypto = new UnifiedAppointmentCrypto();
```

### Staff Authentication

```javascript
async function authenticateStaff(staffId, tenantId) {
  try {
    await crypto.authenticateStaff(staffId, tenantId);
    console.log("Staff authenticated successfully");

    // Crypto system is now ready for encryption/decryption
    return crypto;
  } catch (error) {
    console.error("Authentication failed:", error);
    throw error;
  }
}
```

### Decrypt Appointment Data

```javascript
// Appointment data from API
const appointmentData = {
  encryptedData: "base64-encoded-encrypted-data",
  staffKeyShare: "base64-encoded-encrypted-key",
};

try {
  const decrypted = await cryptoWorker.decryptAppointment(appointmentData);

  // decrypted contains:
  // {
  //   title: 'Appointment Title',
  //   description: 'Appointment Description',
  //   clientEmail: 'patient@example.com',
  //   decryptedAt: '2023-12-07T10:30:00.000Z'
  // }

  console.log("Patient:", decrypted.clientEmail);
  console.log("Appointment:", decrypted.title);
} catch (error) {
  if (error.message.includes("Not authenticated")) {
    // Need to authenticate first
    await cryptoWorker.authenticate(staffId);
    // Retry decryption
  }
}
```

### Check Worker Status

```javascript
const status = await cryptoWorker.getStatus();

console.log("Authenticated:", status.authenticated);
console.log("Staff ID:", status.staffId);
console.log("Session expires at:", new Date(status.expiresAt));
console.log("Time remaining (ms):", status.timeRemaining);
```

### Logout

```javascript
await cryptoWorker.logout();
console.log("All cryptographic data cleared");
```

## Advanced Usage

### Custom Event Handlers

```javascript
// Handle session expiration
cryptoWorker.onSessionExpired = (data) => {
  console.log(`Session expired for staff ${data.staffId}`);
  // Show re-authentication dialog
  showReAuthDialog();
};

// Handle authentication requirement
cryptoWorker.onAuthenticationRequired = () => {
  console.log("Authentication required");
  // Redirect to login or show auth dialog
  redirectToLogin();
};
```

### Batch Processing Multiple Appointments

```javascript
async function decryptMultipleAppointments(appointments) {
  const decryptedAppointments = [];

  for (const appointment of appointments) {
    try {
      const decrypted = await cryptoWorker.decryptAppointment({
        encryptedData: appointment.encryptedData,
        staffKeyShare: appointment.staffKeyShare,
      });

      decryptedAppointments.push({
        ...appointment,
        decryptedData: decrypted,
      });
    } catch (error) {
      console.error(`Failed to decrypt appointment ${appointment.id}:`, error);
      // Handle individual failures gracefully
    }
  }

  return decryptedAppointments;
}
```

### Session Management

```javascript
// Check if authentication is needed before operations
async function ensureAuthenticated(staffId) {
  const status = await cryptoWorker.getStatus();

  if (!status.authenticated || status.timeRemaining < 60000) {
    // Less than 1 minute
    console.log("Re-authenticating...");
    await cryptoWorker.authenticate(staffId);
  }
}

// Use before sensitive operations
await ensureAuthenticated("staff-id-uuid");
const decrypted = await cryptoWorker.decryptAppointment(appointmentData);
```

## Error Handling

### Common Errors

| Error Message                                   | Cause                     | Solution                                  |
| ----------------------------------------------- | ------------------------- | ----------------------------------------- |
| `Worker not initialized`                        | Worker not initialized    | Call `cryptoWorker.initialize()`          |
| `Not authenticated - please authenticate first` | No active session         | Call `cryptoWorker.authenticate(staffId)` |
| `Session expired - please authenticate again`   | 10-minute timeout reached | Re-authenticate with WebAuthn             |
| `Failed to decrypt appointment data`            | Corrupted or invalid data | Check API response format                 |
| `Authentication failed`                         | WebAuthn failure          | Check hardware key or browser support     |

### Error Handling Pattern

```javascript
async function safeDecryptAppointment(appointmentData, staffId) {
  try {
    return await cryptoWorker.decryptAppointment(appointmentData);
  } catch (error) {
    if (error.message.includes("Not authenticated") || error.message.includes("expired")) {
      // Try to re-authenticate
      try {
        await cryptoWorker.authenticate(staffId);
        return await cryptoWorker.decryptAppointment(appointmentData);
      } catch (authError) {
        throw new Error("Re-authentication failed: " + authError.message);
      }
    }

    // Re-throw other errors
    throw error;
  }
}
```

## Security Considerations

### What the Worker Protects Against

- **XSS Attacks**: Private keys are isolated from DOM and main thread
- **Memory Dumps**: Keys are automatically cleared after timeout
- **Debugging**: Private keys cannot be inspected via browser dev tools
- **Extensions**: Malicious browser extensions cannot access worker memory

### What You Still Need to Protect

- **CSRF**: Implement proper CSRF protection on your APIs
- **Network Security**: Use HTTPS for all communications
- **Authentication**: Ensure proper staff authentication before worker access
- **Authorization**: Verify staff permissions server-side

### Best Practices

1. **Always authenticate before operations**:

   ```javascript
   await cryptoWorker.authenticate(staffId);
   ```

2. **Handle session expiration gracefully**:

   ```javascript
   cryptoWorker.onSessionExpired = () => redirectToLogin();
   ```

3. **Clear data on logout**:

   ```javascript
   await cryptoWorker.logout();
   ```

4. **Terminate worker on page unload**:
   ```javascript
   window.addEventListener("beforeunload", () => {
     cryptoWorker.terminate();
   });
   ```

## Integration with Appointment System

### Fetching Staff Appointments

```javascript
// Fetch appointments from API
const response = await fetch(`/api/tenants/${tenantId}/staff/appointments?staffId=${staffId}`);
const { data: appointments } = await response.json();

// Decrypt each appointment
for (const appointment of appointments) {
  const decrypted = await cryptoWorker.decryptAppointment({
    encryptedData: appointment.encryptedData,
    staffKeyShare: appointment.staffKeyShare,
  });

  // Display decrypted data in UI
  displayAppointment(appointment, decrypted);
}
```

### Complete Staff Dashboard Example

```javascript
import { cryptoWorker } from "./crypto-worker-client.js";

class StaffDashboard {
  constructor(staffId, tenantId) {
    this.staffId = staffId;
    this.tenantId = tenantId;
    this.appointments = [];
  }

  async initialize() {
    // Initialize crypto worker
    await cryptoWorker.initialize();

    // Set up event handlers
    cryptoWorker.onSessionExpired = () => this.handleSessionExpired();
    cryptoWorker.onAuthenticationRequired = () => this.handleAuthRequired();

    // Authenticate staff
    await this.authenticate();

    // Load appointments
    await this.loadAppointments();
  }

  async authenticate() {
    try {
      const result = await cryptoWorker.authenticate(this.staffId);
      console.log("Authenticated until:", new Date(result.expiresAt));
      return result;
    } catch (error) {
      throw new Error("Authentication failed: " + error.message);
    }
  }

  async loadAppointments() {
    try {
      // Fetch encrypted appointments
      const response = await fetch(
        `/api/tenants/${this.tenantId}/staff/appointments?staffId=${this.staffId}`,
      );
      const { data: encryptedAppointments } = await response.json();

      // Decrypt appointments
      this.appointments = [];
      for (const appointment of encryptedAppointments) {
        try {
          const decrypted = await cryptoWorker.decryptAppointment({
            encryptedData: appointment.encryptedData,
            staffKeyShare: appointment.staffKeyShare,
          });

          this.appointments.push({
            ...appointment,
            decrypted,
          });
        } catch (error) {
          console.error(`Failed to decrypt appointment ${appointment.id}:`, error);
        }
      }

      this.renderAppointments();
    } catch (error) {
      console.error("Failed to load appointments:", error);
    }
  }

  renderAppointments() {
    const container = document.getElementById("appointments");
    container.innerHTML = "";

    this.appointments.forEach((appointment) => {
      const div = document.createElement("div");
      div.className = "appointment-card";
      div.innerHTML = `
                <h3>${appointment.decrypted.title}</h3>
                <p>Date: ${appointment.appointmentDate}</p>
                <p>Patient: ${appointment.decrypted.clientEmail}</p>
                <p>Description: ${appointment.decrypted.description || "No description"}</p>
                <p>Status: ${appointment.status}</p>
            `;
      container.appendChild(div);
    });
  }

  handleSessionExpired() {
    alert("Your session has expired. Please log in again.");
    window.location.href = "/staff/login";
  }

  handleAuthRequired() {
    this.authenticate().catch((error) => {
      console.error("Re-authentication failed:", error);
      this.handleSessionExpired();
    });
  }

  async cleanup() {
    await cryptoWorker.logout();
    cryptoWorker.terminate();
  }
}

// Usage
const dashboard = new StaffDashboard("staff-id-uuid", "tenant-id-uuid");
dashboard.initialize().catch(console.error);

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  dashboard.cleanup();
});
```

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 16.4+)
- **WebAuthn**: Required for hardware key authentication

## Troubleshooting

### Worker Not Loading

- Check that `crypto-worker.js` is accessible at the correct path
- Verify CORS settings allow worker loading
- Check browser console for loading errors

### Authentication Failures

- Ensure WebAuthn is supported in the browser
- Check that hardware keys are properly registered
- Verify staff credentials are valid

### Decryption Failures

- Ensure appointment data format matches expected structure
- Check that staff has access to the specific appointment
- Verify encryption/decryption key compatibility

### Performance Issues

- Consider implementing appointment pagination
- Use batch processing for multiple appointments
- Monitor worker memory usage

## API Integration

The crypto worker is designed to work with the Open Reception appointment API:

- `GET /api/tenants/{tenantId}/staff/appointments` - Get all staff appointments
- `POST /api/tenants/{tenantId}/staff/appointments` - Get specific appointment

See the main API documentation for complete endpoint specifications.
