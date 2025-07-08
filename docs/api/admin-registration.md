# Admin Registration API Usage

## Flow Overview

1. **POST /api/admin/register** - Create admin account
2. **POST /api/admin/confirm** - Confirm account via email token
3. **POST /api/admin/resend-confirmation** - Resend confirmation email

## API Endpoints

### 1. Register Admin

```bash
POST /api/admin/register
Content-Type: application/json

{
  "name": "Admin Name",
  "email": "admin@example.com",
  "passkey": {
    "id": "credential-id-from-webauthn",
    "publicKey": "base64-encoded-public-key",
    "counter": 0,
    "deviceName": "MacBook Pro"
  }
}
```

**Response (201):**

```json
{
	"message": "Admin account created successfully. Please check your email for confirmation.",
	"adminId": "01234567-89ab-cdef-0123-456789abcdef",
	"email": "admin@example.com"
}
```

### 2. Confirm Admin Account

```bash
POST /api/admin/confirm
Content-Type: application/json

{
  "token": "01234567-89ab-cdef-0123-456789abcdef"
}
```

**Response (200):**

```json
{
	"message": "Admin account confirmed successfully. You can now log in."
}
```

### 3. Resend Confirmation Email

```bash
POST /api/admin/resend-confirmation
Content-Type: application/json

{
  "email": "admin@example.com"
}
```

**Response (200):**

```json
{
	"message": "Confirmation email resent successfully. Please check your email."
}
```

## Error Responses

### 400 Bad Request

```json
{
	"error": "Invalid admin data"
}
```

### 404 Not Found

```json
{
	"error": "Invalid or expired confirmation token"
}
```

### 409 Conflict

```json
{
	"error": "An admin with this email already exists"
}
```

### 500 Internal Server Error

```json
{
	"error": "Internal server error"
}
```

## Implementation Notes

- Admin accounts are created as `isActive: false` and `confirmed: false`
- Confirmation tokens expire after 10 minutes
- Email sending is marked as TODO in the service layer
- After confirmation, admin becomes `isActive: true` and `confirmed: true`
- Passkey is stored during registration and linked to the admin account
- The passkey `id` field is the credential ID from WebAuthn registration
- The passkey `publicKey` field must be base64 encoded
- The passkey `counter` field defaults to 0 if not provided
- The passkey `deviceName` field defaults to "Unknown Device" if not provided
