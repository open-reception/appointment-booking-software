export const ERRORS = {
  BACKEND: {
    OBFUSCATED: "Internal server error",
  },
  VALIDATION: {
    INVALID_REQUEST_BODY: "Invalid request body",
  },
  SECURITY: {
    AUTHENTICATION_REQUIRED: "Authentication required",
    AUTHORIZATION_FAILED: "Insufficient permissions",
    INVALID_PASSKEY_REGISTRATION:
      "Invalid passkey registration. Please request a new challenge first.",
    EITHER_PASSKEY_OR_PHRASE: "Either passkey or passphrase must be provided",
    BOTH_PASSKEY_AND_PHRASE: "Cannot provide both passkey and passphrase",
  },
  TENANTS: {
    NAME_EXISTS: "A tenant with this short name already exists",
    NO_TENANT_ID: "No tenant id given",
    NOT_FOUND: "Tenant not found",
  },
  CHANNELS: {
    NOT_FOUND: "Channel not found",
  },
  USERS: {
    ADMIN_EXISTS: "System was already initialized",
    EMAIL_EXISTS: "E-Mail Address already exists",
    FAILED_TO_UPDATE: "Failed to update user data",
  },
};
