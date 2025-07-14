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
	index
} from "drizzle-orm/pg-core";
import { bytea } from "./base";

/**
 * Config value type enumeration - defines the data type of configuration values
 */
export const configTypeEnum = pgEnum("config_type", ["BOOLEAN", "NUMBER", "STRING"]);

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
		/** Optional description of the organization */
		description: text("description"),
		/** Organization logo as binary data (PNG, JPEG, GIF, or WEBP) */
		logo: bytea("logo"),
		/** Database connection string for this tenant's isolated database */
		databaseUrl: text("database_url").notNull(),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow()
	},
	(table) => ({
		tenantDbUrlUnique: uniqueIndex("tenant_database_url_idx").on(table.databaseUrl)
	})
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
		updatedAt: timestamp("updated_at").defaultNow()
	},
	(table) => ({
		tenantConfigUnique: uniqueIndex("tenant_config_tenant_name_idx").on(table.tenantId, table.name)
	})
);

export const admin = pgTable(
	"admin",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		email: text("email").notNull().unique(),
		name: text("name").notNull(),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
		lastLoginAt: timestamp("last_login_at"),
		isActive: boolean("is_active").default(true),
		confirmed: boolean("confirmed").default(false),
		token: text("token"),
		tokenValidUntil: timestamp("token_valid_until")
	},
	(table) => ({
		emailUnique: uniqueIndex("admin_email_idx").on(table.email)
	})
);

export const adminPasskey = pgTable(
	"admin_passkey",
	{
		id: text("id").primaryKey(), // Credential ID as provided by WebAuthn
		adminId: uuid("admin_id")
			.notNull()
			.references(() => admin.id, { onDelete: "cascade" }),
		publicKey: text("public_key").notNull(), // Base64 encoded
		counter: integer("counter").notNull().default(0),
		deviceName: text("device_name"), // "MacBook Pro", "YubiKey 5", etc.
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
		lastUsedAt: timestamp("last_used_at")
	},
	(table) => ({
		adminPasskeyIdx: index("admin_passkey_admin_idx").on(table.adminId)
	})
);

/**
 * TypeScript type exports for use in application code
 */

/** Tenant record types for database queries */
export type InsertTenant = InferInsertModel<typeof tenant>;
export type SelectTenant = InferSelectModel<typeof tenant>;

/** Tenant config record type for database queries */
export type SelectTenantConfig = InferSelectModel<typeof tenantConfig>;
