import type { InferSelectModel } from "drizzle-orm";
import {
	pgTable,
	boolean,
	uuid,
	text,
	date,
	pgEnum,
	time,
	integer,
	json
} from "drizzle-orm/pg-core";
import { bytea } from "./base";

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
 * Agent table - represents personnel or staff members who can be assigned to channels
 * Agents are the people who provide services and can be associated with multiple channels
 * Stored in tenant-specific database
 * @table agent
 */
export const agent = pgTable("agent", {
	/** Primary key - unique identifier */
	id: uuid("id").primaryKey().defaultRandom(),
	/** Agent's display name */
	name: text("name").notNull(),
	/** Optional description of the agent's role or specialties */
	description: text("description"),
	/** Optional logo/profile image for the agent (PNG, JPEG, GIF, or WEBP) */
	logo: bytea("logo")
});

/**
 * Channel table - represents bookable resources (rooms, machines, personnel)
 * Channels define what can be booked and under what conditions
 * Can be associated with multiple agents and slot templates
 * Stored in tenant-specific database
 * @table channel
 */
export const channel = pgTable("channel", {
	/** Primary key - unique identifier */
	id: uuid("id").primaryKey().defaultRandom(),
	/** Channel display names in multiple languages (array of strings in same order as languages) */
	names: json("names").$type<string[]>().notNull(),
	/** Optional color for UI display (hex code) */
	color: text("color"),
	/** Whether the channel is paused and does not offer nor accept new appointments */
	pause: boolean("paused").notNull().default(false),
	/** Optional descriptions in multiple languages (array of strings in same order as languages) */
	descriptions: json("descriptions").$type<string[]>(),
	/** Active languages for this channel (array of language codes) */
	languages: json("languages").$type<string[]>().notNull(),
	/** Whether channel is publicly bookable or requires internal access */
	isPublic: boolean("is_public"),
	/** Whether appointments must be explicitly confirmed by staff */
	requiresConfirmation: boolean("requires_confirmation")
});

/**
 * Slot Template table - defines recurring time slots for appointment booking
 * Templates specify when appointments can be scheduled on specific weekdays
 * Can be associated with multiple channels to define their availability
 * Stored in tenant-specific database
 * @table slotTemplate
 */
export const slotTemplate = pgTable("slotTemplate", {
	/** Primary key - unique identifier */
	id: uuid("id").primaryKey().defaultRandom(),
	/** Bitmask for weekdays (1=Monday, 2=Tuesday, 4=Wednesday, etc.) */
	weekdays: integer("weekdays"),
	/** Start time for the slot template */
	from: time("from").notNull(),
	/** End time for the slot template */
	to: time("to").notNull(),
	/** Duration of individual appointment slots in minutes */
	duration: integer("duration").notNull()
});

/**
 * Channel-Agent junction table - establishes many-to-many relationship
 * Links channels with the agents who can provide services for that channel
 * Stored in tenant-specific database
 * @table channelAgent
 */
export const channelAgent = pgTable("channel_agent", {
	/** Foreign key to channel */
	channelId: uuid("channel_id")
		.notNull()
		.references(() => channel.id),
	/** Foreign key to agent */
	agentId: uuid("agent_id")
		.notNull()
		.references(() => agent.id)
});

/**
 * Channel-SlotTemplate junction table - establishes many-to-many relationship
 * Links channels with the slot templates that define their availability
 * Stored in tenant-specific database
 * @table channelSlotTemplate
 */
export const channelSlotTemplate = pgTable("channel_slot_template", {
	/** Foreign key to channel */
	channelId: uuid("channel_id")
		.notNull()
		.references(() => channel.id),
	/** Foreign key to slot template */
	slotTemplateId: uuid("slot_template_id")
		.notNull()
		.references(() => slotTemplate.id)
});

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

/** Agent record type for database queries */
export type SelectAgent = InferSelectModel<typeof agent>;

/** Slot template record type for database queries */
export type SelectSlotTemplate = InferSelectModel<typeof slotTemplate>;

/** Channel-Agent junction record type for database queries */
export type SelectChannelAgent = InferSelectModel<typeof channelAgent>;

/** Channel-SlotTemplate junction record type for database queries */
export type SelectChannelSlotTemplate = InferSelectModel<typeof channelSlotTemplate>;
