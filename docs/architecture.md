# Overall Architecture – Open Reception

## Project Overview

Open Reception is an end-to-end encrypted appointment booking platform, funded by the German Federal Ministry of Research, Technology and Space and the PrototypeFund. License: AGPL-3.0.

## Tech Stack

- **Framework**: SvelteKit 5 (SSR + SPA) with TypeScript
- **UI**: Tailwind CSS 4, shadcn/svelte (bits-ui), Lucide Icons
- **Database**: PostgreSQL 16 via Drizzle ORM
- **Authentication**: JWT (jose), WebAuthn/Passkeys (@simplewebauthn/server)
- **Cryptography**: ML-KEM-768/Kyber (@noble/post-quantum), AES-256-GCM, Argon2, Shamir Secret Sharing
- **Email**: Nodemailer with Svelte-rendered templates
- **i18n**: Paraglide (German, English)
- **Logging**: Winston (UniversalLogger)
- **Validation**: Zod, sveltekit-superforms + formsnap
- **Testing**: Vitest (unit), Playwright (E2E)
- **Infrastructure**: Docker Compose, Caddy (reverse proxy + HTTPS)

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Clients                         │
│            (Browser – Clients / Staff)              │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│                Caddy Reverse Proxy                  │
│         (TLS Termination, Security Headers,         │
│          On-Demand TLS, Gzip Compression)           │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP :3000
┌──────────────────────▼──────────────────────────────┐
│              SvelteKit Application                  │
│  ┌────────────────────────────────────────────────┐ │
│  │            Server Hooks Pipeline               │ │
│  │  startup → logging → i18n → rateLimit →        │ │
│  │  cors → secHeaders → apiAuth → authGuard       │ │
│  └────────────────────────────────────────────────┘ │
│  ┌──────────────────┐  ┌────────────────────────┐   │
│  │   API Routes     │  │   Page Routes (SSR)    │   │
│  │   /api/...       │  │   /(pages)/...         │   │
│  └────────┬─────────┘  └───────────┬────────────┘   │
│  ┌────────▼─────────────────────────▼────────────┐   │
│  │              Service Layer                    │   │
│  │  AppointmentService, AgentService,            │   │
│  │  ChannelService, ScheduleService,             │   │
│  │  StaffCryptoService, NotificationService,     │   │
│  │  SessionService, AuthorizationService,        │   │
│  │  EmailService, InviteService, ...             │   │
│  └────────┬──────────────────────────────────────┘   │
│  ┌────────▼──────────────────────────────────────┐   │
│  │            Database Layer (Drizzle ORM)        │   │
│  └────────┬──────────────────────────────────────┘   │
└───────────┼──────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────┐
│                  PostgreSQL 16                        │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  Central DB      │  │  Tenant DB (per tenant)  │  │
│  │  - tenant        │  │  - agent                 │  │
│  │  - user          │  │  - channel               │  │
│  │  - user_passkey  │  │  - slot_template         │  │
│  │  - user_session  │  │  - appointment           │  │
│  │  - user_invite   │  │  - notification          │  │
│  │  - tenant_config │  │  - staff_crypto          │  │
│  │  - challenge_    │  │  - client_appointment_   │  │
│  │    throttle      │  │    tunnel                │  │
│  └──────────────────┘  │  - appointment_key_share │  │
│                        │  - agent_absence         │  │
│                        │  - auth_challenge        │  │
│                        │  - client_pin_reset_     │  │
│                        │    token                 │  │
│                        └──────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Multi-Tenant Architecture

The system uses **database-per-tenant isolation**: each tenant receives its own PostgreSQL database. The central database manages tenant metadata, users, and sessions.

- **Central DB**: Contains `tenant`, `user`, `user_passkey`, `user_session`, `user_invite`, `tenant_config`, `challenge_throttle`
- **Tenant DB** (per tenant): Contains all business-specific data (appointments, channels, agents, cryptographic material)
- **Connection management**: `getTenantDb()` resolves the database connection at runtime by `tenantId` and caches connections in a Map

### Tenant Lifecycle

Each tenant passes through five states during onboarding:
`SETTINGS` → `AGENTS` → `CHANNELS` → `STAFF` → `READY`

## User Roles & Authorization

Three roles with hierarchical access:

1. **GLOBAL_ADMIN** – Full access to all tenants, can create/delete tenants
2. **TENANT_ADMIN** – Management of a single tenant (channels, agents, staff, settings)
3. **STAFF** – Operational access to the calendar and appointments of their own tenant

Authorization is enforced via `AuthorizationService` and `checkPermission()`, each with tenant-scope verification.

## Authentication

### Staff/Admin Authentication
- **WebAuthn/Passkeys** as the primary method
- **Passphrase** as an alternative method
- JWT Access Tokens (15 min) + Refresh Tokens (7 days)
- Sessions stored in the central database
- Token validation against the DB on every API call

### Client Authentication (Appointment Bookers)
- **PIN-based** with challenge-response protocol
- Email hash for privacy-preserving identification
- Argon2 for PIN derivation
- Challenge throttling against brute-force attacks

## End-to-End Encryption

### Core Principle: Zero-Knowledge Server

The server never has access to unencrypted personal data at any point.

### Cryptographic Primitives
- **ML-KEM-768 (Kyber)**: Post-quantum secure key exchange
- **AES-256-GCM**: Symmetric encryption of appointment data
- **Shamir Secret Sharing (2-of-2)**: Private key splitting
- **Argon2**: PIN-based key derivation (client-side)

### Staff Key Management
- Kyber key pair is generated in the browser
- Private key is split into two shards via XOR:
  - **Passkey shard**: Derived from WebAuthn `authenticatorData`
  - **DB shard**: Stored in the tenant database (`staff_crypto`)
- Reconstruction requires both shards (during login)

### Client Tunnel Concept
- Each client receives an encrypted "tunnel" per tenant
- Tunnel key (AES-256) encrypts all of the client's appointments
- Tunnel key is encrypted separately for each staff member using their Kyber public key
- Client private key: Shamir split (PIN shard + server shard)

## Server Hooks Pipeline

The request processing chain (`hooks.server.ts`) in execution order:

1. **startupHandle** – DB migrations, housekeeping scheduler (every 12h)
2. **loggingHandle** – Request/response logging
3. **i18nHandle** – Locale detection and setting
4. **rateLimitHandle** – IP-based rate limiting (20 req/2s)
5. **corsHandle** – CORS headers
6. **secHeaderHandle** – Security headers (CSP, HSTS, etc.)
7. **apiAuthHandle** – JWT validation for API routes
8. **authGuard** – Page-based access control (dashboard protection)

## Frontend Structure

### Route Groups
- `/(pages)/(clients)/` – Public client pages (appointment booking, client login)
- `/(pages)/dashboard/` – Protected admin/staff area
- `/(pages)/login/`, `/logout/`, `/setup/`, `/confirm/` – Authentication flows
- `/api/` – REST API with OpenAPI documentation

### Dashboard Areas
- **Calendar** – Day view with appointments and slots
- **Channels** – Management of bookable resources
- **Agents** – Management of persons/contacts
- **Staff** – User management with roles
- **Absences** – Agent absences
- **Tenants** – Tenant management (GLOBAL_ADMIN only)
- **Settings** – Tenant configuration

### UI Component Library
Based on shadcn/svelte with custom extensions:
- **Layouts**: `sidebar-layout`, `centered-card`, `empty-layout`, `max-page-width`
- **Templates**: `empty-state`, `form-grid`, `list`, `loading`, `language-switch`
- **UI Primitives**: button, card, dialog, form, input, calendar, combobox, etc.

## Email System

- Svelte components as email templates (server-side rendered)
- Supported email types: confirmation, invitation, appointment booking, appointment reminder, appointment rejection, appointment cancellation, PIN reset
- HTML + plaintext output
- Language-dependent templates (de/en)

## Docker Infrastructure

### Development
- Only PostgreSQL as a Docker container
- SvelteKit runs locally via `npm run dev`

### Production
Three containers in an internal network:

1. **PostgreSQL** – Read-only filesystem, Docker secrets, SCRAM-SHA-256
2. **SvelteKit App** – Rootless (UID 1001), read-only, healthcheck at `/api/health`
3. **Caddy** – HTTPS with on-demand TLS (Let's Encrypt), security headers, gzip

### Container Security Measures
- `no-new-privileges`, `cap_drop: ALL`
- Read-only root filesystems with tmpfs
- Docker secrets instead of environment variables (production)
- Internal networks, only Caddy exposes ports

## Startup & Housekeeping

On application start (`StartupService`):
1. Migrate central database
2. Migrate all tenant databases in parallel
3. Start housekeeping scheduler (every 12 hours):
   - Clean up expired invitations
   - Delete expired sessions
   - Remove expired PIN reset tokens per tenant
