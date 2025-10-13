import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Database enums for tenant-specific entities
 */

/** Appointment status enumeration - tracks the lifecycle of appointments */
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "NEW",
  "CONFIRMED",
  "HELD",
  "REJECTED",
  "NO_SHOW",
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
  descriptions: json("descriptions").$type<{ [key: string]: string }>().notNull(),
  /** Optional logo/profile image for the agent (PNG, JPEG, GIF, or WEBP) */
  image: varchar("image", { length: 250_000 }),
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
  names: json("names").$type<{ [key: string]: string }>().notNull(),
  /** Optional color for UI display (hex code) */
  color: text("color"),
  /** Whether the channel is paused and does not offer nor accept new appointments */
  pause: boolean("paused").notNull().default(false),
  /** Optional descriptions in multiple languages (array of strings in same order as languages) */
  descriptions: json("descriptions").$type<{ [key: string]: string }>().notNull(),
  /** Whether channel is publicly bookable or requires internal access */
  isPublic: boolean("is_public"),
  /** Whether appointments must be explicitly confirmed by staff */
  requiresConfirmation: boolean("requires_confirmation"),
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
  duration: integer("duration").notNull(),
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
    .references(() => agent.id),
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
    .references(() => slotTemplate.id),
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
  language: text("language"),
});

/**
 * Appointment table - represents scheduled appointments between clients and channels
 * Uses hybrid encryption: symmetric key for data, asymmetric for key sharing
 * Stored in tenant-specific database
 * @table appointment
 */
export const appointment = pgTable("appointment", {
  /** Primary key - unique identifier */
  id: uuid("id").primaryKey().defaultRandom(),
  /** Foreign key to client appointment tunnel */
  tunnelId: uuid("tunnel_id")
    .notNull()
    .references(() => clientAppointmentTunnel.id),
  /** Foreign key to channel/resource being booked */
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channel.id),
  /** Foreign key to agent being booked */
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agent.id),
  /** Date and time of the appointment */
  appointmentDate: timestamp("appointment_date").notNull(),
  /** When appointment data expires and can be auto-deleted */
  expiryDate: date("expiry_date"),
  /** Current status of the appointment - defaults depend on channel's requiresConfirmation setting */
  status: appointmentStatusEnum("status").notNull(),
  /** Encrypted appointment data (name, email, phone) - Legacy field */
  encryptedData: text("encrypted_data"),
  /** Symmetric key for encrypting appointment data - Legacy field */
  dataKey: text("data_key"),
  /** AES-encrypted payload for end-to-end encryption (new system) */
  encryptedPayload: text("encrypted_payload"),
  /** Initialization vector for AES encryption (new system) */
  iv: text("iv"),
  /** Authentication tag for AES-GCM (new system) */
  authTag: text("auth_tag"),
  /** Timestamp when the appointment was created */
  createdAt: timestamp("created_at").defaultNow(),
  /** Timestamp when the appointment was last updated */
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Agent Absence table - represents periods when agents are unavailable
 * Used to block agent availability during vacation, training, meetings, etc.
 * Stored in tenant-specific database
 * @table agentAbsence
 */
export const agentAbsence = pgTable("agent_absence", {
  /** Primary key - unique identifier */
  id: uuid("id").primaryKey().defaultRandom(),
  /** Foreign key to agent who is absent */
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agent.id),
  /** Start date and time of absence */
  startDate: timestamp("start_date").notNull(),
  /** End date and time of absence */
  endDate: timestamp("end_date").notNull(),
  /** Type of absence (free text: Urlaub, Krankheit, Fortbildung, etc.) */
  absenceType: text("absence_type").notNull().default(""),
  /** Optional description/reason for absence */
  description: text("description"),
});

/**
 * AppointmentKeyShare table - stores the symmetric key encrypted for each staff member
 * Allows staff and admins to decrypt appointment data
 * @table appointmentKeyShare
 */
export const appointmentKeyShare = pgTable("appointment_key_share", {
  /** Primary key - unique identifier */
  id: uuid("id").primaryKey().defaultRandom(),
  /** Foreign key to appointment */
  appointmentId: uuid("appointment_id")
    .notNull()
    .references(() => appointment.id),
  /** Foreign key to staff member who can decrypt. This is not a reference this the user is stored in another db */
  userId: uuid("user_id").notNull(),
  /** Symmetric key encrypted with this staff member's public key */
  encryptedKey: text("encrypted_key").notNull(),
});

/**
 * TypeScript type exports for use in application code
 * These types represent the shape of data when queried from the database
 */

/** Client record type for database queries */
export type SelectClient = InferSelectModel<typeof client>;

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

/** Agent absence record type for database queries */
export type SelectAgentAbsence = InferSelectModel<typeof agentAbsence>;

/**
 * StaffCrypto table - stores encryption keys for staff members within tenant scope
 * Enables end-to-end encryption for appointments in tenant database
 * @table staffCrypto
 */
export const staffCrypto = pgTable("staff_crypto", {
  /** Primary key - unique identifier */
  id: uuid("id").primaryKey().defaultRandom(),
  /** Foreign key to central user table */
  userId: uuid("user_id").notNull(),
  /** ML-KEM-768 (Kyber) public key for this staff member (Base64 encoded) */
  publicKey: text("public_key").notNull(),
  /** Database-stored shard of the private key (Base64 encoded) */
  privateKeyShare: text("private_key_share").notNull(),
  /** Associated passkey ID for key derivation */
  passkeyId: text("passkey_id").notNull(),
  /** Timestamp when the key was created */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  /** Timestamp when the key was last updated */
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  /** Whether this key is currently active */
  isActive: boolean("is_active").default(true).notNull(),
});

/**
 * ClientAppointmentTunnels table - represents encrypted appointment tunnels for clients
 * Each tunnel represents a client and contains their encrypted appointment data
 * @table clientAppointmentTunnel
 */
export const clientAppointmentTunnel = pgTable("client_appointment_tunnel", {
  /** Primary key - unique identifier (this IS the client identifier) */
  id: uuid("id").primaryKey().defaultRandom(),
  /** SHA-256 hash of client email for privacy-preserving lookups */
  emailHash: text("email_hash").notNull().unique(),
  /** Client's ML-KEM-768 public key for this tunnel (Base64 encoded) */
  clientPublicKey: text("client_public_key").notNull(),
  /** Server-stored share of client's private key (encrypted, for PIN recovery) */
  privateKeyShare: text("private_key_share").notNull(),
  /** Tunnel encryption key encrypted with client's public key */
  clientEncryptedTunnelKey: text("client_key_share").notNull(),
  /** Timestamp when the tunnel was created */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  /** Timestamp when the tunnel was last updated */
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * ClientTunnelStaffKeyShares table - stores tunnel keys encrypted for each staff member
 * Allows staff to decrypt appointments in client tunnels
 * @table clientTunnelStaffKeyShare
 */
export const clientTunnelStaffKeyShare = pgTable("client_tunnel_staff_key_share", {
  /** Primary key - unique identifier */
  id: uuid("id").primaryKey().defaultRandom(),
  /** Foreign key to client appointment tunnel */
  tunnelId: uuid("tunnel_id")
    .notNull()
    .references(() => clientAppointmentTunnel.id),
  /** Foreign key to staff user */
  userId: uuid("user_id").notNull(),
  /** Tunnel key encrypted with staff member's public key */
  encryptedTunnelKey: text("encrypted_tunnel_key").notNull(),
  /** Timestamp when this key share was created */
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * AuthChallenge table - stores temporary authentication challenges
 * Used for client authentication during tunnel access
 * @table authChallenge
 */
export const authChallenge = pgTable("auth_challenge", {
  /** Primary key - challenge ID */
  id: text("id").primaryKey(),
  /** The challenge value (base64 encoded) */
  challenge: text("challenge").notNull(),
  /** Email hash of the client this challenge is for */
  emailHash: text("email_hash").notNull(),
  /** When this challenge was created */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  /** When this challenge expires */
  expiresAt: timestamp("expires_at").notNull(),
  /** Whether this challenge has been consumed (one-time use) */
  consumed: boolean("consumed").default(false).notNull(),
});

/** StaffCrypto record type for database queries */
export type SelectStaffCrypto = InferSelectModel<typeof staffCrypto>;

/** ClientAppointmentTunnel record type for database queries */
export type SelectClientAppointmentTunnel = InferSelectModel<typeof clientAppointmentTunnel>;

/** ClientTunnelStaffKeyShare record type for database queries */
export type SelectClientTunnelStaffKeyShare = InferSelectModel<typeof clientTunnelStaffKeyShare>;
