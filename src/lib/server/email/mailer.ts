import nodemailer from "nodemailer";
import { env } from "$env/dynamic/private";
import type { SelectClient } from "$lib/server/db/tenant-schema";
import type Mail from "nodemailer/lib/mailer";
import type { SelectUser } from "../db/central-schema";

/**
 * Email recipient interface
 * @interface EmailRecipient
 * @property {string} email - Recipient's email address
 * @property {string} [name] - Optional recipient name
 * @property {string} [language] - Optional language preference (de/en)
 */
export interface EmailRecipient {
  email: string;
  name?: string;
  language?: string;
}

/**
 * Create an EmailRecipient from database user objects
 * @param {SelectClient | SelectStaff} user - Database user object (client or staff)
 * @returns {EmailRecipient} Email recipient object
 * @throws {Error} When user has no email address
 */
export function createEmailRecipient(
  user:
    | SelectClient
    | SelectUser
    | { id: string; email: string | null; name: string | null; language?: string | null },
): EmailRecipient {
  // Handle SelectUser type (from central schema)
  if ("email" in user && !("publicKey" in user)) {
    return {
      email: user.email || "",
      name: user.name || undefined,
      language: user.language || "de", // Use user's language preference
    };
  }
  // Handle SelectClient type (no name property)
  else {
    return {
      email: user.email || "", // Client email is optional
      name: undefined, // Clients don't have names for privacy
      language: user.language || "de",
    };
  }
}

/**
 * Create SMTP transporter with environment configuration
 * @returns {nodemailer.Transporter} Configured SMTP transporter
 * @throws {Error} When SMTP configuration is incomplete
 * @private
 */
function createTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error("SMTP configuration is incomplete. Please check your environment variables.");
  }
  const config = {
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT),
    secure: env.SMTP_SECURE === "true",
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  };
  return nodemailer.createTransport(config);
}

/**
 * Send an email with HTML and plain text content
 * @param {EmailRecipient} recipient - Email recipient information
 * @param {string} subject - Email subject line
 * @param {string} htmlContent - HTML email content
 * @param {string} textContent - Plain text email content
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendEmail(
  recipient: EmailRecipient,
  subject: string,
  htmlContent: string,
  textContent: string,
): Promise<void> {
  const transporter = createTransporter();

  if (!recipient.email) {
    // Recipient has not stored an email address, so no mail will be send
    // TODO: Log this event
    return;
  }

  const from_address = env.SMTP_FROM_EMAIL || env.SMTP_USER;

  if (!from_address) {
    throw new Error("From address is required");
  }

  const mailOptions: Mail.Options = {
    from: {
      name: env.SMTP_FROM_NAME || "Open Reception",
      address: from_address,
    },
    to: {
      name: recipient.name || "",
      address: recipient.email,
    },
    subject,
    html: htmlContent,
    text: textContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${recipient.email}`);
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new Error(`Failed to send email to ${recipient.email}`);
  }
}

/**
 * Test SMTP connection
 * @returns {Promise<boolean>} True if connection successful, false otherwise
 */
export async function testEmailConnection(): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error("SMTP connection test failed:", error);
    return false;
  }
}
