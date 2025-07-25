# API Route overview

## Public routes (limited by cors, but not by authorization)

- `/api/auth/challenge` - Performs a Webauthn challenge
- `/api/auth/login` - User login (staff, tenant admin or global admin)
- `/api/auth/confirm` - Confirm an invite code for an invited user (or the global admin on initial creation)
- `/api/auth/resend-confirmation` - Resend a confirmation code
- `/api/health` - System health stats
- `/api/docs` - OpenAPI docs
- `/api/openapi.json` - OpenAPI schema
- `/api/log` - Create an entry in the log file from the frontend
- `/api/admin/init` - Initialize a new system (sends out global admin invite)
- `/api/admin/exists` - Whether a global admin exists (and the system was already initialized)
- `/api/auth/register` - Register a new user (that was invited)

## Authorized routes

- `/api/admin/tenant` (GLOBAL ADMIN) - Switch active tenant
- `/api/auth/invite` (GLOBAL ADMIN, TENANT ADMIN) - Invite new user to a tenant
- `/api/auth/logout` - Log out current user
- `/api/auth/passkey` - Add a new passkey to the current user account
- `/api/auth/refresh` - Refresh session token
- `/api/auth/session` - Get user session information
- `/api/auth/sessions` (GlOBAL ADMIN) - Revoke all sessions for a user
- `/api/auth/sessions/[id]` (GlOBAL ADMIN) - Revoke a specific sessions for a user
- `/api/tenants` (GlOBAL ADMIN) - Create a new tenant or get the id's of all tenants
- `/api/tenants/config` (GlOBAL ADMIN, TENANT ADMIN) - Get default configuration for tenants
- `/api/tenants/[id]` (GlOBAL ADMIN, TENANT ADMIN) - Get or change specific tenant
- `/api/tenants/[id]/config` (GlOBAL ADMIN, TENANT ADMIN) - Get or change specific tenant configuration
- `/api/tenants/[id]/setuo-state` (GlOBAL ADMIN, TENANT ADMIN) - Update the setup state of a tenant
