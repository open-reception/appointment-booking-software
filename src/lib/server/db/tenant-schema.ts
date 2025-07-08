import type { InferSelectModel } from "drizzle-orm";
import {
	pgTable,
	uuid,
	text,
	date,
	pgEnum
} from "drizzle-orm/pg-core";

/**
 * Database enums for tenant-specific entities
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
 * Client table - represents end users who book appointments
 * Uses end-to-end encryption for privacy protection
 * Stored in tenant-specific database
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
 * Stored in tenant-specific database
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
 * Stored in tenant-specific database
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
 * Stored in tenant-specific database
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

/** Client record type for database queries */
export type SelectClient = InferSelectModel<typeof client>;

/** Staff record type for database queries */
export type SelectStaff = InferSelectModel<typeof staff>;

/** Channel record type for database queries */
export type SelectChannel = InferSelectModel<typeof channel>;

/** Appointment record type for database queries */
export type SelectAppointment = InferSelectModel<typeof appointment>;