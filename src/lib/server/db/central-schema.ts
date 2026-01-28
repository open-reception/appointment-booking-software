import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  pgEnum,
  uniqueIndex,
  boolean,
  timestamp,
  integer,
  index,
  varchar,
  json,
} from "drizzle-orm/pg-core";

/**
 * Config value type enumeration - defines the data type of configuration values
 */
export const configTypeEnum = pgEnum("config_type", ["BOOLEAN", "NUMBER", "STRING"]);

/**
 * User role enumeration - defines the different user roles in the system
 */
export const userRoleEnum = pgEnum("user_role", ["GLOBAL_ADMIN", "TENANT_ADMIN", "STAFF"]);
export const confirmationStateEnum = pgEnum("confirmation_state", [
  "INVITED",
  "CONFIRMED",
  "ACCESS_GRANTED",
]);

// Warning: Duplication in src/lib/const/tenants.ts
export const tenantSetupState = pgEnum("setup_state", [
  "SETTINGS", // Settings need to be saved initially
  "AGENTS", // At least one agent needs to be created
  "CHANNELS", // At least one channel needs to be created
  "STAFF", // At least one staff member needs to be created
  "READY", // Tenant is fully set up and ready to use
]);

/**
 * Central Tenant table - stored in the main database
 * Contains tenant metadata and database connection information
 * Each tenant gets their own isolated database for all other entities
 * @table tenant
 */
export const tenant = pgTable(
  "tenant",
  {
    /** Primary key - unique identifier */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Short name used as subdomain (e.g., 'acme' for acme.example.com) */
    shortName: text("short_name").notNull().unique(),
    /** Full organization name displayed to users */
    longName: text("long_name").notNull(),
    /** Optional descriptions of the organization */
    descriptions: json("descriptions").$type<{ [key: string]: string }>().notNull(),
    /** Active languages for this tenant (array of language codes) */
    languages: json("languages").$type<string[]>().notNull(),
    /** Active languages for this tenant (array of language codes) */
    defaultLanguage: text("defaultLanguage").notNull().default("en"),
    /** Organization logo as binary data (PNG, JPEG, GIF, or WEBP) */
    logo: varchar("logo", { length: 100_000 }),
    /** Database connection string for this tenant's isolated database */
    databaseUrl: text("database_url").notNull(),
    /** State of tenant setup */
    setupState: tenantSetupState("setup_state").notNull().default("SETTINGS"),
    /** Links (object) */
    links: json("links")
      .$type<{ imprint?: string; privacyStatement?: string; website?: string }>()
      .notNull()
      .default({}),
    /** Domain for the tenant */
    domain: text("domain").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantDbUrlUnique: uniqueIndex("tenant_database_url_idx").on(table.databaseUrl),
  }),
);

/**
 * Tenant Configuration table - stores configuration entries for each tenant
 * Each tenant can have multiple configuration entries with different types
 * @table tenant_config
 */
export const tenantConfig = pgTable(
  "tenant_config",
  {
    /** Primary key - unique identifier */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Foreign key to tenant */
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    /** Configuration entry name/key */
    name: text("name").notNull(),
    /** Data type of the configuration value */
    type: configTypeEnum("type").notNull(),
    /** Configuration value stored as text (parsed based on type) */
    value: text("value").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantConfigUnique: uniqueIndex("tenant_config_tenant_name_idx").on(table.tenantId, table.name),
  }),
);

// TODO: Filter in API für bestimmte Rollen

export const user = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull().default("STAFF"),
    tenantId: uuid("tenant_id").references(() => tenant.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    lastLoginAt: timestamp("last_login_at"),
    isActive: boolean("is_active").default(true),
    confirmationState: confirmationStateEnum("confirmation_state").default("INVITED"),
    token: text("token"),
    tokenValidUntil: timestamp("token_valid_until"),
    /** Hashed passphrase for password authentication (optional, alternative to WebAuthn) */
    passphraseHash: text("passphrase_hash"),
    /** Recovery passphrase for WebAuthn-only users (stored in plain text, shown only once) */
    recoveryPassphrase: text("recovery_passphrase"),
    /** User's preferred language for emails and interface */
    language: text("language").notNull().default("de"),
  },
  (table) => ({
    emailUnique: uniqueIndex("user_email_idx").on(table.email),
  }),
);

export const userPasskey = pgTable(
  "user_passkey",
  {
    id: text("id").primaryKey(), // Credential ID as provided by WebAuthn
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(), // Base64 encoded
    counter: integer("counter").notNull().default(0),
    deviceName: text("device_name"), // "MacBook Pro", "YubiKey 5", etc.
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => ({
    userPasskeyIdx: index("user_passkey_user_idx").on(table.userId),
  }),
);

/**
 * User Session table - stores active user sessions
 * Sessions are identified by secure HTTP-only cookies
 * Contains JWT tokens for API authentication
 * @table user_session
 */
export const userSession = pgTable(
  "user_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionToken: text("session_token").notNull().unique(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    /** Passkey ID used for authentication (if WebAuthn was used) */
    passkeyId: text("passkey_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    lastUsedAt: timestamp("last_used_at").defaultNow(),
  },
  (table) => ({
    userSessionIdx: index("user_session_user_idx").on(table.userId),
    sessionTokenIdx: uniqueIndex("user_session_token_idx").on(table.sessionToken),
  }),
);

/**
 * User Invitation table - stores pending invitations with secure codes
 * Invitations are created when users are invited to join a tenant
 * Contains all necessary information without exposing it in URLs
 * @table user_invite
 */
export const userInvite = pgTable(
  "user_invite",
  {
    /** Primary key - unique identifier */
    id: uuid("id").primaryKey().defaultRandom(),
    /** Secure invite code sent to user (UUID v4) */
    inviteCode: uuid("invite_code").notNull().unique().defaultRandom(),
    /** Email address of invited user */
    email: text("email").notNull(),
    /** Name of invited user */
    name: text("name").notNull(),
    /** Role to assign to user when they register */
    role: userRoleEnum("role").notNull(),
    /** Tenant the user is being invited to */
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    /** User who sent the invitation */
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Language preference for the invitation */
    language: text("language").notNull().default("de"),
    /** Whether the invitation has been used */
    used: boolean("used").notNull().default(false),
    /** When the invitation was used (if applicable) */
    usedAt: timestamp("used_at"),
    /** User ID that was created from this invitation (if used) */
    createdUserId: uuid("created_user_id").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    /** Invitation expires after 7 days */
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    inviteCodeIdx: uniqueIndex("user_invite_code_idx").on(table.inviteCode),
    inviteEmailIdx: index("user_invite_email_idx").on(table.email),
    inviteTenantIdx: index("user_invite_tenant_idx").on(table.tenantId),
  }),
);

/**
 * Challenge Throttle table - tracks failed authentication attempts for all challenge types
 * Used to implement rate limiting for both PIN and passkey authentication
 * Stored centrally to prevent brute force attacks across all tenants
 * @table challenge_throttle
 */
export const challengeThrottle = pgTable("challenge_throttle", {
  /** Primary key - identifier (email hash for PIN challenges, email for passkey challenges) */
  id: text("id").primaryKey(),
  /** Number of failed attempts */
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  /** When the throttle was last updated */
  lastAttemptAt: timestamp("last_attempt_at").defaultNow().notNull(),
  /** When the throttle should reset/expire */
  resetAt: timestamp("reset_at").notNull(),
});

/**
 * TypeScript type exports for use in application code
 */

/** Tenant record types for database queries */
export type InsertTenant = InferInsertModel<typeof tenant>;
export type SelectTenant = InferSelectModel<typeof tenant>;

/** Tenant config record type for database queries */
export type SelectTenantConfig = InferSelectModel<typeof tenantConfig>;

/** User record types for database queries */
export type InsertUser = InferInsertModel<typeof user>;
export type SelectUser = InferSelectModel<typeof user>;

/** User passkey record types for database queries */
export type InsertUserPasskey = InferInsertModel<typeof userPasskey>;
export type SelectUserPasskey = InferSelectModel<typeof userPasskey>;

/** User session record types for database queries */
export type InsertUserSession = InferInsertModel<typeof userSession>;
export type SelectUserSession = InferSelectModel<typeof userSession>;

/** User invite record types for database queries */
export type InsertUserInvite = InferInsertModel<typeof userInvite>;
export type SelectUserInvite = InferSelectModel<typeof userInvite>;
