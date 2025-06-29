import type { InferSelectModel } from "drizzle-orm";
import {
	pgTable,
	uuid,
	text,
	boolean,
	integer,
	customType,
	date,
	pgEnum
} from "drizzle-orm/pg-core";

/**
 * Custom PostgreSQL bytea type for binary data storage
 * Used for storing encrypted data, images, and other binary content
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return "bytea";
	}
});

/**
 * Database enums
 */

/** Channel type enumeration - defines what kind of resource a channel represents */
export const channelTypeEnum = pgEnum("channel_type", ["ROOM", "MACHINE", "PERSONNEL"]);

/** Appointment status enumeration - tracks the lifecycle of appointments */
export const appointmentStatusEnum = pgEnum("appointment_status", [
	"NEW",
	"CONFIRMED",
	"HELD",
	"REJECTED",
	"NO_SHOW"
]);

/**
 * Tenant table - represents a single organization/company using the system
 * Each tenant gets their own isolated data and subdomain
 * @table tenant
 */
export const tenant = pgTable("tenant", {
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
	/** Background color for email templates and UI theming */
	backgroundColor: text("background_color"),
	/** Primary brand color for buttons, links, and highlights */
	primaryColor: text("primary_color"),
	/** Secondary brand color for accents and success messages */
	secondaryColor: text("secondary_color"),
	/** Default language for the tenant (de/en) */
	defaultLanguage: text("default_language").default("de"),
	/** Days after appointment completion before auto-deletion */
	autoDeleteDays: integer("auto_delete_days").default(365),
	/** Whether appointments require explicit confirmation */
	requireConfirmation: boolean("require_confirmation").default(false)
});

/**
 * Client table - represents end users who book appointments
 * Uses end-to-end encryption for privacy protection
 * @table client
 */
export const client = pgTable("client", {
	/** Primary key - unique identifier */
	id: uuid("id").primaryKey().defaultRandom(),
	/** Hash of client email for identification without storing plaintext */
	hashKey: text("hash_key").notNull().unique(),
	/** Client's public key for end-to-end encryption */
	publicKey: text("public_key").notNull(),
	/** Server-side share of client's private key for recovery */
	privateKeyShare: text("private_key_share").notNull(),
	/** Client email address (optional for privacy) */
	email: text("email"),
	/** Preferred language for communications (de/en) */
	language: text("language")
});

/**
 * Staff table - represents employees/staff members who manage appointments
 * Staff members have administrative access and can view/manage appointments
 * @table staff
 */
export const staff = pgTable("staff", {
	/** Primary key - unique identifier */
	id: uuid("id").primaryKey().defaultRandom(),
	/** Hash of staff login name for identification */
	hashKey: text("hash_key").notNull().unique(),
	/** Staff member's public key for end-to-end encryption */
	publicKey: text("public_key").notNull(),
	/** Staff member's display name */
	name: text("name"),
	/** Job title or position within the organization */
	position: text("position"),
	/** Staff email address (required for notifications) */
	email: text("email").notNull(),
	/** Preferred language for communications (de/en) */
	language: text("language")
});

/**
 * Channel table - represents bookable resources (rooms, machines, personnel)
 * Channels define what can be booked and when
 * @table channel
 */
export const channel = pgTable("channel", {
	/** Primary key - unique identifier */
	id: uuid("id").primaryKey().defaultRandom(),
	/** Type of channel (ROOM, MACHINE, or PERSONNEL) */
	type: channelTypeEnum("type").notNull(),
	/** Display name of the channel */
	name: text("name").notNull(),
	/** Optional description of the channel and its capabilities */
	description: text("description")
});

/**
 * Appointment table - represents scheduled appointments between clients and channels
 * Contains encrypted appointment data for privacy protection
 * @table appointment
 */
export const appointment = pgTable("appointment", {
	/** Primary key - unique identifier */
	id: uuid("id").primaryKey().defaultRandom(),
	/** Foreign key to client who booked the appointment */
	clientId: uuid("client_id")
		.notNull()
		.references(() => client.id),
	/** Foreign key to channel/resource being booked */
	channelId: uuid("channel_id")
		.notNull()
		.references(() => channel.id),
	/** Date and time of the appointment */
	appointmentDate: date("appointment_date").notNull(),
	/** When appointment data expires and can be auto-deleted */
	expiryDate: date("expiry_date").notNull(),
	/** Appointment title/subject */
	title: text("title").notNull(),
	/** Optional detailed description of the appointment */
	description: text("description"),
	/** Current status of the appointment */
	status: appointmentStatusEnum("status").notNull().default("NEW")
});

/**
 * TypeScript type exports for use in application code
 * These types represent the shape of data when queried from the database
 */

/** Tenant record type for database queries */
export type SelectTenant = InferSelectModel<typeof tenant>;

/** Client record type for database queries */
export type SelectClient = InferSelectModel<typeof client>;

/** Staff record type for database queries */
export type SelectStaff = InferSelectModel<typeof staff>;

/** Channel record type for database queries */
export type SelectChannel = InferSelectModel<typeof channel>;

/** Appointment record type for database queries */
export type SelectAppointment = InferSelectModel<typeof appointment>;
