import { sendEmail, type EmailRecipient, createEmailRecipient } from "./mailer";
import {
  templateEngine,
  type EmailTemplateType,
  type TemplateData,
  type Language,
} from "./template-engine";
import type { SelectAppointment } from "$lib/server/db/tenant-schema";
import type { SelectTenant, SelectUser } from "$lib/server/db/central-schema";
import { getTenantDb } from "$lib/server/db";
import * as tenantSchema from "$lib/server/db/tenant-schema";
import { eq } from "drizzle-orm";
import { setLocale } from "$i18n/runtime";
import { m } from "$i18n/messages";
import { render } from "svelte/server";
import AppointmentBooked from "$lib/emails/AppointmentBooked.svelte";
import AppointmentRequest from "$lib/emails/AppointmentRequest.svelte";
import AppointmentRejected from "$lib/emails/AppointmentRejected.svelte";
import { htmlToText, renderOutputToHtml } from "$lib/emails/utils";
import { AgentService } from "../services/agent-service";
import { TenantService } from "../db/tenant-service";
import Confirmation from "$lib/emails/Confirmation.svelte";
import PinReset from "$lib/emails/PinReset.svelte";
import UserInvite from "$lib/emails/UserInvite.svelte";

export type SelectClient = {
  email: string;
  language: string;
};

export type SelectUserEmail = Pick<SelectUser, "email" | "name" | "language">;

/**
 * Get channel title in the user's preferred language
 * @param {string} tenantId - Tenant ID
 * @param {string} channelId - Channel ID
 * @param {string} [userLanguage="de"] - User's preferred language
 * @returns {Promise<string | undefined>} Channel title or undefined if not found
 */
export async function getChannelTitle(
  tenantId: string,
  channelId: string,
  userLanguage: string = "de",
): Promise<string | undefined> {
  try {
    const db = await getTenantDb(tenantId);
    const channelResult = await db
      .select({
        names: tenantSchema.channel.names,
      })
      .from(tenantSchema.channel)
      .where(eq(tenantSchema.channel.id, channelId))
      .limit(1);

    if (channelResult.length === 0 || !channelResult[0].names) {
      return undefined;
    }

    const names = channelResult[0].names as Record<string, string>;
    return names[userLanguage] || names["de"] || names["en"] || Object.values(names)[0];
  } catch {
    // Return undefined on error, don't throw - this is optional information for emails
    return undefined;
  }
}

/**
 * Send a templated email using the template engine
 * @param {EmailTemplateType} templateType - Type of email template to use
 * @param {EmailRecipient} recipient - Email recipient information
 * @param {string} subject - Email subject line
 * @param {Language} language - Template language (defaults to 'de')
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {Record<string, unknown>} templateData - Additional template variables
 * @throws {Error} When template rendering or email sending fails
 * @returns {Promise<void>}
 */
export async function sendTemplatedEmail(
  templateType: EmailTemplateType,
  recipient: EmailRecipient,
  subject: string,
  language: Language = "en",
  tenant: SelectTenant,
  templateData: Record<string, unknown> = {},
): Promise<void> {
  const data: TemplateData = {
    recipient,
    subject,
    language,
    tenant,
    ...templateData,
  };

  try {
    const rendered = await templateEngine.renderTemplate(templateType, data);
    await sendEmail(recipient, rendered.subject, rendered.html, rendered.text);
  } catch (error) {
    console.error(`Failed to send templated email (${templateType}):`, error);
    throw error;
  }
}

/**
 * Send welcome email to newly created user
 * @param {SelectClient | SelectUser} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {string} loginUrl - URL for user to login
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendUserCreatedEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  loginUrl: string,
): Promise<void> {
  const recipient = createEmailRecipient(user);
  const language = (recipient.language as Language) || "en";
  const subject = language === "en" ? "Welcome to Open Reception" : "Willkommen bei Open Reception";

  await sendTemplatedEmail("user-created", recipient, subject, language, tenant, {
    loginUrl,
  });
}

/**
 * Send informational email about PIN reset (no reset code included)
 * @param {SelectClient | SelectUser} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendPinResetEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  requestUrl: URL,
): Promise<void> {
  const recipient = createEmailRecipient(user);
  const locale = (recipient.language as Language) || "en";

  const subject = m["emails.pinReset.subject"]({
    tenant: tenant.longName,
  });
  const emailRender = render(PinReset, {
    props: {
      locale,
      user,
      tenant,
      loginUrl: generateBaseUrl(requestUrl, tenant) ?? "http://localhost:5173",
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  await sendEmail(recipient, subject, html, text);
}

/**
 * Send informational email about key reset
 * @param {SelectClient | SelectUser} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendKeyResetEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
): Promise<void> {
  const recipient = createEmailRecipient(user);
  const language = (recipient.language as Language) || "en";
  const subject = language === "en" ? "Key Reset Information" : "Schlüssel zurückgesetzt";

  await sendTemplatedEmail("key-reset", recipient, subject, language, tenant, {});
}

/**
 * Send appointment reminder email
 * @param {SelectClient | SelectUser} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Appointment details
 * @param {string} [cancelUrl] - Optional URL to cancel appointment
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentReminderEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  appointment: SelectAppointment,
  cancelUrl?: string,
): Promise<void> {
  const agentService = await AgentService.forTenant(tenant.id);
  const agent = await agentService.getAgentById(appointment.agentId);
  const { recipient, locale } = await getRecipient(user);
  const channelTitle = await getChannelTitle(tenant.id, appointment.channelId, locale);
  // Generate email
  const subject = m["emails.appointmentReminder.subject"]({
    tenant: tenant.longName,
  });
  const emailRender = render(AppointmentBooked, {
    props: {
      locale,
      channel: channelTitle || appointment.channelId,
      user,
      tenant,
      appointment: { ...appointment, agentName: agent?.name ?? "---" },
      address: await getAddressFromTenant(tenant.id),
      cancelUrl: cancelUrl || "",
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  await sendEmail(recipient, subject, html, text);
}

const getRecipient = async (user: SelectClient | SelectUser) => {
  const recipient: EmailRecipient =
    "email" in user && typeof user.email === "string" && "language" in user && !("name" in user)
      ? { email: user.email, language: user.language }
      : createEmailRecipient(user);
  const locale = (recipient.language as Language) || "en";
  setLocale(locale);
  return { recipient, locale };
};

const getAddressFromTenant = async (tenantId: string) => {
  const tenantService = await new TenantService(tenantId);
  const tenant = await tenantService.getConfig();
  return {
    street: (tenant["address.street"] || "") as string,
    number: (tenant["address.number"] || "") as string,
    additionalAddressInfo: (tenant["address.additionalAddressInfo"] || "") as string,
    zip: (tenant["address.zip"] || "") as string,
    city: (tenant["address.city"] || "") as string,
  };
};

/**
 * Send appointment rejection email for newly created appointments
 * @param {SelectClient | SelectUser} user - Database user object or client data
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Appointment details
 * @param {string} [channelTitle] - Optional channel title/name
 * @param {string} [cancelUrl] - Optional URL to cancel appointment
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentRejectedEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  appointment: SelectAppointment,
  channelTitle?: string,
): Promise<void> {
  // Create recipient directly for SelectClient type, use helper for SelectUser

  // Set language
  const agentService = await AgentService.forTenant(tenant.id);
  const agent = await agentService.getAgentById(appointment.agentId);
  const { recipient, locale } = await getRecipient(user);

  // Generate email
  const subject = m["emails.appointmentRejected.subject"]({
    channel: channelTitle || appointment.channelId,
    tenant: tenant.longName,
  });
  const emailRender = render(AppointmentRejected, {
    props: {
      locale,
      channel: channelTitle || appointment.channelId,
      user,
      tenant,
      appointment: { ...appointment, agentName: agent?.name ?? "---" },
      address: await getAddressFromTenant(tenant.id),
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  await sendEmail(recipient, subject, html, text);
}

/**
 * Send appointment confirmation email for newly created appointments
 * @param {SelectClient | SelectUser} user - Database user object or client data
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Appointment details
 * @param {string} [channelTitle] - Optional channel title/name
 * @param {string} [cancelUrl] - Optional URL to cancel appointment
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentCreatedEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  appointment: SelectAppointment,
  channelTitle?: string,
  cancelUrl?: string,
): Promise<void> {
  // Create recipient directly for SelectClient type, use helper for SelectUser

  // Set language
  const agentService = await AgentService.forTenant(tenant.id);
  const agent = await agentService.getAgentById(appointment.agentId);
  const { recipient, locale } = await getRecipient(user);

  // Generate email
  const subject = m["emails.appointmentBooked.subject"]({
    channel: channelTitle || appointment.channelId,
    tenant: tenant.longName,
  });
  const emailRender = render(AppointmentBooked, {
    props: {
      locale,
      channel: channelTitle || appointment.channelId,
      user,
      tenant,
      appointment: { ...appointment, agentName: agent?.name ?? "---" },
      address: await getAddressFromTenant(tenant.id),
      cancelUrl: cancelUrl || "",
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  await sendEmail(recipient, subject, html, text);
}

/**
 * Send appointment request email (when staff confirmation is required)
 * @param {SelectClient | SelectUser} user - Database user object or client data
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Appointment details
 * @param {string} [channelTitle] - Optional channel title/name
 * @param {string} [cancelUrl] - Optional URL to cancel appointment
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentRequestEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  appointment: SelectAppointment,
  channelTitle?: string,
): Promise<void> {
  const agentService = await AgentService.forTenant(tenant.id);
  const agent = await agentService.getAgentById(appointment.agentId);
  const { recipient, locale } = await getRecipient(user);
  // Generate email
  const subject = m["emails.appointmentRequest.subject"]({
    channel: channelTitle || appointment.channelId,
    tenant: tenant.longName,
  });
  const emailRender = render(AppointmentRequest, {
    props: {
      locale,
      channel: channelTitle || appointment.channelId,
      user,
      tenant,
      appointment: { ...appointment, agentName: agent?.name ?? "---" },
      address: await getAddressFromTenant(tenant.id),
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  await sendEmail(recipient, subject, html, text);
}

/**
 * Send appointment update notification email
 * @param {SelectClient | SelectUser} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Updated appointment details
 * @param {string} [channelTitle] - Optional channel title/name
 * @param {string} [cancelUrl] - Optional URL to cancel appointment
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentUpdatedEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  appointment: SelectAppointment,
  channelTitle?: string,
  cancelUrl?: string,
): Promise<void> {
  const recipient = createEmailRecipient(user);
  const language = (recipient.language as Language) || "en";
  const subject = language === "en" ? "Appointment Updated" : "Termin aktualisiert";

  await sendTemplatedEmail("appointment-updated", recipient, subject, language, tenant, {
    appointment,
    appointmentDate: appointment.appointmentDate,
    title: channelTitle || appointment.channelId,
    cancelUrl,
  });
}

/**
 * Generate base URL for email templates based on request URL and tenant
 * @param {URL} requestUrl - The request URL
 * @param {SelectTenant | null} tenant - Tenant information (null for global admin)
 * @returns {string} The appropriate base URL
 */
export function generateBaseUrl(requestUrl: URL, tenant: SelectTenant | null): string {
  const protocol = requestUrl.protocol;
  const port = requestUrl.port ? `:${requestUrl.port}` : "";
  const hostname = requestUrl.hostname;

  // In development, always use the original hostname regardless of tenant
  if (hostname === "localhost" || hostname.startsWith("127.") || hostname.startsWith("192.168.")) {
    return `${protocol}//${hostname}${port}`;
  }

  // In production, handle tenant subdomains
  if (tenant?.shortName) {
    const parts = hostname.split(".");

    if (parts.length > 2) {
      // Complex subdomain - use only the last two parts (domain.tld) and add tenant
      const domain = parts.slice(-2).join(".");
      return `${protocol}//${tenant.shortName}.${domain}${port}`;
    } else {
      // Main domain, prepend tenant subdomain
      return `${protocol}//${tenant.shortName}.${hostname}${port}`;
    }
  }

  // For global admin or no tenant, use main domain
  return `${protocol}//${hostname}${port}`;
}

/**
 * Send registration confirmation email with one-time code
 * @param {SelectClient | SelectStaff} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {string} confirmationCode - One-time confirmation code
 * @param {number} [expirationMinutes=15] - Code expiration time in minutes
 * @param {URL} [requestUrl] - Request URL for generating baseUrl
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendConfirmationEmail(
  user: { id: string; email: string; name: string; language?: string | null },
  tenant: SelectTenant,
  confirmationCode: string,
  expirationMinutes: number = 15,
  requestUrl?: URL,
): Promise<void> {
  // Generate appropriate base URL if request URL is provided
  const baseUrl = requestUrl ? generateBaseUrl(requestUrl, tenant) : "http://localhost:5173";
  const confirmUrl = `${baseUrl}/confirm/${confirmationCode}`;
  const recipient = user;
  // Generate email
  const subject = m["emails.confirmation.subject"]({
    tenant: tenant.longName,
  });
  const emailRender = render(Confirmation, {
    props: {
      locale: (user.language as Language) ?? "en",
      user: user as SelectUserEmail,
      confirmUrl,
      expirationMinutes,
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await sendEmail(recipient as any, subject, html, text);
}

/**
 * Send user invitation email for existing tenant
 * @param {string} userEmail - Email address of the invited user
 * @param {string} userName - Name of the invited user
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {string} role - Role to assign to the user (TENANT_ADMIN or STAFF) - for logging only
 * @param {string} registrationUrl - URL for user to register (contains secure invite code)
 * @param {Language} [language="en"] - Email language
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendUserInviteEmail(
  userEmail: string,
  userName: string,
  tenant: SelectTenant,
  role: "TENANT_ADMIN" | "STAFF",
  registrationUrl: string,
  language: Language = "en",
): Promise<void> {
  const recipient: EmailRecipient = {
    email: userEmail,
    name: userName,
    language,
  };

  // Generate email
  const subject = m["emails.userInvite.subject"]({
    tenant: tenant.longName,
  });
  const emailRender = render(UserInvite, {
    props: {
      locale: language ?? "en",
      user: recipient as SelectUserEmail,
      tenant,
      confirmUrl: registrationUrl,
      expirationMinutes: 30,
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await sendEmail(recipient as any, subject, html, text);
}

/**
 * Send appointment cancellation email
 * @param {SelectClient | SelectUser} user - Database user object or client data
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Cancelled appointment details
 * @param {string} [channelTitle] - Optional channel title/name
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentCancelledEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  appointment: SelectAppointment,
  channelTitle?: string,
): Promise<void> {
  // Create recipient directly for SelectClient type, use helper for SelectUser
  const recipient: EmailRecipient =
    "email" in user && typeof user.email === "string" && "language" in user && !("name" in user)
      ? { email: user.email, language: user.language }
      : createEmailRecipient(user);

  const language = (recipient.language as Language) || "en";
  const subject = language === "en" ? "Appointment Cancelled" : "Termin storniert";

  await sendTemplatedEmail("appointment-cancelled", recipient, subject, language, tenant, {
    appointment,
    appointmentDate: appointment.appointmentDate,
    title: channelTitle || appointment.channelId,
  });
}
