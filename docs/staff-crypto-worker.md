# Staff Crypto Worker Documentation

## Overview

The Staff Crypto Worker provides secure, isolated cryptographic operations for staff members accessing encrypted appointment data. By running cryptographic operations in a Web Worker, sensitive private keys are kept isolated from the main thread, providing protection against XSS attacks and other web-based vulnerabilities.

## Architecture

```
Main Thread (UI) ↔ Crypto Worker ↔ WebAuthn/Hardware Keys
```

- **Main Thread**: Handles UI and business logic, never sees private keys
- **Crypto Worker**: Isolated context for all cryptographic operations
- **WebAuthn**: Hardware-backed authentication for key derivation

## Key Features

- **Memory Isolation**: Private keys never leave the worker context
- **XSS Protection**: Main thread cannot access cryptographic keys
- **Automatic Cleanup**: Keys are automatically cleared after inactivity
- **Session Management**: 10-minute session timeout with extension on use
- **WebAuthn Integration**: Hardware-backed authentication for key derivation

## Installation

1. Copy the worker files to your project:
   - `src/lib/crypto-worker.js` - The Web Worker implementation
   - `src/lib/crypto-worker-client.js` - Main thread client interface

2. Ensure your web server serves the worker file with proper MIME type:
   ```javascript
   // Make sure crypto-worker.js is accessible at /src/lib/crypto-worker.js
   ```

## Basic Usage

### Initialize the Worker

```javascript
import { cryptoWorker } from './crypto-worker-client.js';

// Initialize the worker
await cryptoWorker.initialize();
```

### Authenticate Staff Member

```javascript
try {
    const authResult = await cryptoWorker.authenticate('staff-id-uuid');
    console.log('Authenticated until:', new Date(authResult.expiresAt));
    
    // authResult contains:
    // {
    //   authenticated: true,
    //   expiresAt: timestamp,
    //   staffId: 'staff-id-uuid'
    // }
} catch (error) {
    console.error('Authentication failed:', error.message);
}
```

### Decrypt Appointment Data

```javascript
// Appointment data from API
const appointmentData = {
    encryptedData: 'base64-encoded-encrypted-data',
    staffKeyShare: 'base64-encoded-encrypted-key'
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
    
    console.log('Patient:', decrypted.clientEmail);
    console.log('Appointment:', decrypted.title);
    
} catch (error) {
    if (error.message.includes('Not authenticated')) {
        // Need to authenticate first
        await cryptoWorker.authenticate(staffId);
        // Retry decryption
    }
}
```

### Check Worker Status

```javascript
const status = await cryptoWorker.getStatus();

console.log('Authenticated:', status.authenticated);
console.log('Staff ID:', status.staffId);
console.log('Session expires at:', new Date(status.expiresAt));
console.log('Time remaining (ms):', status.timeRemaining);
```

### Logout

```javascript
await cryptoWorker.logout();
console.log('All cryptographic data cleared');
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
    console.log('Authentication required');
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
                staffKeyShare: appointment.staffKeyShare
            });
            
            decryptedAppointments.push({
                ...appointment,
                decryptedData: decrypted
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
    
    if (!status.authenticated || status.timeRemaining < 60000) { // Less than 1 minute
        console.log('Re-authenticating...');
        await cryptoWorker.authenticate(staffId);
    }
}

// Use before sensitive operations
await ensureAuthenticated('staff-id-uuid');
const decrypted = await cryptoWorker.decryptAppointment(appointmentData);
```

## Error Handling

### Common Errors

| Error Message | Cause | Solution |
|---------------|--------|----------|
| `Worker not initialized` | Worker not initialized | Call `cryptoWorker.initialize()` |
| `Not authenticated - please authenticate first` | No active session | Call `cryptoWorker.authenticate(staffId)` |
| `Session expired - please authenticate again` | 10-minute timeout reached | Re-authenticate with WebAuthn |
| `Failed to decrypt appointment data` | Corrupted or invalid data | Check API response format |
| `Authentication failed` | WebAuthn failure | Check hardware key or browser support |

### Error Handling Pattern

```javascript
async function safeDecryptAppointment(appointmentData, staffId) {
    try {
        return await cryptoWorker.decryptAppointment(appointmentData);
        
    } catch (error) {
        if (error.message.includes('Not authenticated') || 
            error.message.includes('expired')) {
            
            // Try to re-authenticate
            try {
                await cryptoWorker.authenticate(staffId);
                return await cryptoWorker.decryptAppointment(appointmentData);
            } catch (authError) {
                throw new Error('Re-authentication failed: ' + authError.message);
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
   window.addEventListener('beforeunload', () => {
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
        staffKeyShare: appointment.staffKeyShare
    });
    
    // Display decrypted data in UI
    displayAppointment(appointment, decrypted);
}
```

### Complete Staff Dashboard Example

```javascript
import { cryptoWorker } from './crypto-worker-client.js';

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
            console.log('Authenticated until:', new Date(result.expiresAt));
            return result;
        } catch (error) {
            throw new Error('Authentication failed: ' + error.message);
        }
    }
    
    async loadAppointments() {
        try {
            // Fetch encrypted appointments
            const response = await fetch(
                `/api/tenants/${this.tenantId}/staff/appointments?staffId=${this.staffId}`
            );
            const { data: encryptedAppointments } = await response.json();
            
            // Decrypt appointments
            this.appointments = [];
            for (const appointment of encryptedAppointments) {
                try {
                    const decrypted = await cryptoWorker.decryptAppointment({
                        encryptedData: appointment.encryptedData,
                        staffKeyShare: appointment.staffKeyShare
                    });
                    
                    this.appointments.push({
                        ...appointment,
                        decrypted
                    });
                    
                } catch (error) {
                    console.error(`Failed to decrypt appointment ${appointment.id}:`, error);
                }
            }
            
            this.renderAppointments();
            
        } catch (error) {
            console.error('Failed to load appointments:', error);
        }
    }
    
    renderAppointments() {
        const container = document.getElementById('appointments');
        container.innerHTML = '';
        
        this.appointments.forEach(appointment => {
            const div = document.createElement('div');
            div.className = 'appointment-card';
            div.innerHTML = `
                <h3>${appointment.decrypted.title}</h3>
                <p>Date: ${appointment.appointmentDate}</p>
                <p>Patient: ${appointment.decrypted.clientEmail}</p>
                <p>Description: ${appointment.decrypted.description || 'No description'}</p>
                <p>Status: ${appointment.status}</p>
            `;
            container.appendChild(div);
        });
    }
    
    handleSessionExpired() {
        alert('Your session has expired. Please log in again.');
        window.location.href = '/staff/login';
    }
    
    handleAuthRequired() {
        this.authenticate().catch(error => {
            console.error('Re-authentication failed:', error);
            this.handleSessionExpired();
        });
    }
    
    async cleanup() {
        await cryptoWorker.logout();
        cryptoWorker.terminate();
    }
}

// Usage
const dashboard = new StaffDashboard('staff-id-uuid', 'tenant-id-uuid');
dashboard.initialize().catch(console.error);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
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