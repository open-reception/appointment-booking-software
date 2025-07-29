# API Routes Authentication Overview

This document provides a comprehensive overview of all API routes and their authentication requirements.

## 🔓 Public Routes (No Authentication Required)

### Authentication Routes

- `/api/auth/challenge` - Generate WebAuthn challenge
- `/api/auth/login` - User login (WebAuthn or passphrase)
- `/api/auth/register` - User registration
- `/api/auth/confirm` - Email confirmation
- `/api/auth/resend-confirmation` - Resend confirmation email

### System Routes

- `/api/health` - Health check
- `/api/health/services` - Service health status
- `/api/docs` - API documentation
- `/api/openapi.json` - OpenAPI specification
- `/api/env` - Environment information
- `/api/log` - Logging endpoint

### Admin Setup Routes

- `/api/admin/init` - Initialize first global admin
- `/api/admin/exists` - Check if global admin exists

## 🔒 Protected Routes (Authentication Required)

### Protected Auth Routes (Any Authenticated User)

- `/api/auth/logout` - User logout
- `/api/auth/refresh` - Refresh authentication tokens
- `/api/auth/session` - Get current session info
- `/api/auth/sessions` - Manage user sessions
- `/api/auth/sessions/[sessionId]` - Manage specific session
- `/api/auth/passkeys` - Add additional WebAuthn keys

### Global Admin Routes (GLOBAL_ADMIN Role Required)

- `/api/tenants` - Create and list tenants
- `/api/tenants/[id]` - Manage specific tenant
- `/api/tenants/[id]/config` - Tenant configuration
- `/api/tenants/config/defaults` - Default tenant configuration

### Admin Routes (ADMIN Role Required)

- `/api/admin/tenant` - Tenant management for admins

## 📋 Route Categories

### By Authentication Level:

1. **Public**: 12 routes - No authentication required
2. **Protected Auth**: 6 routes - Any authenticated user
3. **Global Admin**: 5 routes - GLOBAL_ADMIN role required

### By Functionality:

- **Authentication**: 11 routes (5 public, 6 protected)
- **Admin Management**: 2 routes (2 public)
- **Tenant Management**: 5 routes (5 global admin)
- **System/Utility**: 6 routes (6 public)

## 🔧 Implementation Details

### Authentication Flow:

1. **Session Cookie**: `session` cookie for browser-based auth
2. **Bearer Token**: Authorization header for API access
3. **Role Checking**: `AuthorizationService.hasRole()` for role verification

### Security Features:

- JWT token verification
- Session validation
- Role-based access control (RBAC)
- Proper HTTP status codes (401 vs 403)
- Detailed logging for security events

### Configuration Location:

- Main config: `src/server-hooks/authHandle.ts`
- Authorization service: `src/lib/server/auth/authorization-service.ts`
- Session service: `src/lib/server/auth/session-service.ts`

## 🚨 Security Considerations

1. **Public Routes**: Should be carefully reviewed for security implications
2. **Protected Routes**: Require valid authentication but no specific roles
3. **Global Admin Routes**: High privilege routes requiring GLOBAL_ADMIN role
4. **Rate Limiting**: Applied to all routes via `rateLimitHandle`
5. **CORS**: Properly configured for API access
6. **HTTPS**: Security headers enforced in production

## 📝 Notes

- All routes are automatically covered by the authentication middleware
- New API routes should be explicitly added to the appropriate category
- Role requirements are enforced at the middleware level
- Session management is handled automatically for authenticated routes
