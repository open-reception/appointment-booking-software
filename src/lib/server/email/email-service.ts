import { dev } from "$app/environment";
import { m } from "$i18n/messages";
import AppointmentBooked from "$lib/emails/AppointmentBooked.svelte";
import AppointmentCancelled from "$lib/emails/AppointmentCancelled.svelte";
import AppointmentRejected from "$lib/emails/AppointmentRejected.svelte";
import AppointmentReminder from "$lib/emails/AppointmentReminder.svelte";
import AppointmentRequest from "$lib/emails/AppointmentRequest.svelte";
import AppointmentUpdated from "$lib/emails/AppointmentUpdated.svelte";
import Confirmation from "$lib/emails/Confirmation.svelte";
import Notification from "$lib/emails/Notification.svelte";
import PinReset from "$lib/emails/PinReset.svelte";
import { htmlToText, renderOutputToHtml } from "$lib/emails/utils";
import type { SelectTenant, SelectUser } from "$lib/server/db/central-schema";
import type { SelectAgent, SelectAppointment, SelectChannel } from "$lib/server/db/tenant-schema";
import { createIcsFileForClient, tenantAddressToIcsLocation } from "$lib/utils/ics";
import type Mail from "nodemailer/lib/mailer";
import { render } from "svelte/server";
import { TenantService } from "../db/tenant-service";
import { AgentService } from "../services/agent-service";
import { ChannelService } from "../services/channel-service";
import { createEmailRecipient, sendEmail, type EmailRecipient } from "./mailer";
import {
  templateEngine,
  type EmailTemplateType,
  type Language,
  type TemplateData,
} from "./template-engine";

export type SelectClient = {
  email: string;
  language: string;
};

export type TenantAddress = {
  street: string;
  number: string;
  zip: string;
  city: string;
};

export type SelectUserEmail = Pick<SelectUser, "email" | "name" | "language">;

/**
 * Get channel name in the user's preferred language
 * @param {SelectChannel} channel - Channel object
 * @param {string} [userLanguage="de"] - User's preferred language
 * @returns {string} Channel title
 */
export function getChannelName(channel: SelectChannel | null, userLanguage: string = "en"): string {
  const names = channel?.names as Record<string, string> | undefined;
  return names?.[userLanguage] || names?.["en"] || Object.values(names || {})[0] || m["unknown"]();
}

function generateAttachmentsForAppointment(
  tenant: SelectTenant,
  channel: SelectChannel | null,
  agent: SelectAgent | null,
  appointment: SelectAppointment,
  address: TenantAddress,
  locale: string,
) {
  const attachments: Mail.Attachment[] = [];
  const content = createIcsFileForClient(new URL(`https://${tenant.domain}`), [
    {
      id: appointment.id,
      isRequested: false,
      title: `${tenant.longName}: ${getChannelName(channel, locale)}`,
      location: tenantAddressToIcsLocation(address),
      start: new Date(appointment.appointmentDate),
      duration: appointment.duration,
      attendees: [{ name: agent?.name || m["unknown"](), email: "user@openreception" }],
    },
  ]).value;
  if (content) {
    attachments.push({
      filename: `${tenant.longName} - ${getChannelName(channel, locale)}.ics`,
      content,
      contentType: "text/calendar",
    });
  }
  return attachments;
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
    await sendEmail(recipient, rendered.subject, rendered.html, rendered.text, tenant.longName);
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
  token: string,
  expirationMinutes: number,
  emailHash: string,
): Promise<void> {
  const recipient = createEmailRecipient(user);
  const locale = (recipient.language as Language) || "en";

  const subject = m["emails.pinReset.subject"](
    {
      tenant: tenant.longName,
    },
    { locale },
  );
  const emailRender = render(PinReset, {
    props: {
      locale,
      user,
      tenant,
      resetUri: `${dev ? `http://localhost:5173` : generateBaseUrl(requestUrl)}/set-pin/${token}/${emailHash}`,
      expirationMinutes,
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  await sendEmail(recipient, subject, html, text, tenant.longName);
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
): Promise<void> {
  const agentService = await AgentService.forTenant(tenant.id);
  const agent = await agentService.getAgentById(appointment.agentId);
  const channelService = await ChannelService.forTenant(tenant.id);
  const channel = await channelService.getChannelById(appointment.channelId);
  const { recipient, locale } = await getRecipient(user);
  // Generate email
  const subject = m["emails.appointmentReminder.subject"](
    {
      tenant: tenant.longName,
    },
    { locale },
  );

  const address = await getAddressFromTenant(tenant.id);
  const attachments = generateAttachmentsForAppointment(
    tenant,
    channel,
    agent,
    appointment,
    address,
    locale,
  );
  const emailRender = render(AppointmentReminder, {
    props: {
      locale,
      channel,
      user,
      tenant,
      appointment: { ...appointment, agentName: agent?.name ?? "---" },
      address,
      cancelUrl: dev ? `http://localhost:5173/clients` : `https://${tenant.domain}/clients`,
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  await sendEmail(recipient, subject, html, text, tenant.longName, attachments);
}

const getRecipient = async (user: SelectClient | SelectUser) => {
  const recipient: EmailRecipient =
    "email" in user && typeof user.email === "string" && "language" in user && !("name" in user)
      ? { email: user.email, language: user.language }
      : createEmailRecipient(user);
  const locale = (recipient.language as Language) || "en";
  return { recipient, locale };
};

const getAddressFromTenant = async (tenantId: string) => {
  const tenantService = new TenantService(tenantId);
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
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentRejectedEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  appointment: SelectAppointment,
): Promise<void> {
  // Create recipient directly for SelectClient type, use helper for SelectUser

  // Set language
  const agentService = await AgentService.forTenant(tenant.id);
  const agent = await agentService.getAgentById(appointment.agentId);
  const channelService = await ChannelService.forTenant(tenant.id);
  const channel = await channelService.getChannelById(appointment.channelId);
  const { recipient, locale } = await getRecipient(user);

  // Generate email
  const subject = m["emails.appointmentRejected.subject"](
    {
      channel: getChannelName(channel),
      tenant: tenant.longName,
    },
    { locale },
  );
  const emailRender = render(AppointmentRejected, {
    props: {
      locale,
      channel,
      user,
      tenant,
      appointment: { ...appointment, agentName: agent?.name ?? "---" },
      address: await getAddressFromTenant(tenant.id),
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  await sendEmail(recipient, subject, html, text, tenant.longName);
}

/**
 * Send appointment confirmation email for newly created appointments
 * @param {SelectClient | SelectUser} user - Database user object or client data
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Appointment details
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentCreatedEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  appointment: SelectAppointment,
): Promise<void> {
  // Create recipient directly for SelectClient type, use helper for SelectUser

  // Set language
  const agentService = await AgentService.forTenant(tenant.id);
  const agent = await agentService.getAgentById(appointment.agentId);
  const channelService = await ChannelService.forTenant(tenant.id);
  const channel = await channelService.getChannelById(appointment.channelId);
  const { recipient, locale } = await getRecipient(user);

  // Generate email
  const subject = m["emails.appointmentBooked.subject"](
    {
      channel: getChannelName(channel),
      tenant: tenant.longName,
    },
    { locale },
  );
  const address = await getAddressFromTenant(tenant.id);
  const attachments = generateAttachmentsForAppointment(
    tenant,
    channel,
    agent,
    appointment,
    address,
    locale,
  );
  const emailRender = render(AppointmentBooked, {
    props: {
      locale,
      channel,
      user,
      tenant,
      appointment: { ...appointment, agentName: agent?.name ?? "---" },
      address,
      cancelUrl: dev ? `http://localhost:5173/clients` : `https://${tenant.domain}/clients`,
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  await sendEmail(recipient, subject, html, text, tenant.longName, attachments);
}

/**
 * Send appointment request email (when staff confirmation is required)
 * @param {SelectClient | SelectUser} user - Database user object or client data
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Appointment details
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentRequestEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  appointment: SelectAppointment,
): Promise<void> {
  const agentService = await AgentService.forTenant(tenant.id);
  const agent = await agentService.getAgentById(appointment.agentId);
  const channelService = await ChannelService.forTenant(tenant.id);
  const channel = await channelService.getChannelById(appointment.channelId);
  const { recipient, locale } = await getRecipient(user);
  // Generate email
  const subject = m["emails.appointmentRequest.subject"](
    {
      channel: getChannelName(channel),
      tenant: tenant.longName,
    },
    { locale },
  );
  const address = await getAddressFromTenant(tenant.id);
  const attachments = generateAttachmentsForAppointment(
    tenant,
    channel,
    agent,
    appointment,
    address,
    locale,
  );
  const emailRender = render(AppointmentRequest, {
    props: {
      locale,
      channel,
      user,
      tenant,
      appointment: { ...appointment, agentName: agent?.name ?? "---" },
      address,
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  await sendEmail(recipient, subject, html, text, tenant.longName, attachments);
}

/**
 * Generate base URL for email templates based on request URL and tenant
 * @param {URL} requestUrl - The request URL
 * @param {SelectTenant | null} tenant - Tenant information (null for global admin)
 * @returns {string} The appropriate base URL
 */
export function generateBaseUrl(url: URL): string {
  const protocol = url.protocol;
  const port = url.port ? `:${url.port}` : "";
  const hostname = url.hostname;
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
  requestUrl: URL,
): Promise<void> {
  // Generate appropriate base URL if request URL is provided
  const baseUrl = generateBaseUrl(requestUrl);
  const confirmUrl = `${baseUrl}/confirm/${confirmationCode}`;
  const recipient = user;
  const locale = (user.language as Language) ?? "en";
  // Generate email
  const subject = m["emails.confirmation.subject"](
    {
      tenant: tenant.longName,
    },
    { locale },
  );
  const emailRender = render(Confirmation, {
    props: {
      locale,
      user: user as SelectUserEmail,
      confirmUrl,
      expirationMinutes,
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await sendEmail(recipient as any, subject, html, text, tenant.longName);
}

/**
 * Send appointment update email
 * @param {SelectClient | SelectUser} user - Database user object or client data
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Cancelled appointment details
 * @param {string} [channelTitle] - Optional channel title/name
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentUpdatedEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  appointment: SelectAppointment,
): Promise<void> {
  const agentService = await AgentService.forTenant(tenant.id);
  const agent = await agentService.getAgentById(appointment.agentId);
  const channelService = await ChannelService.forTenant(tenant.id);
  const channel = await channelService.getChannelById(appointment.channelId);
  // Create recipient directly for SelectClient type, use helper for SelectUser
  const { recipient, locale } = await getRecipient(user);
  // Generate email
  const subject = m["emails.appointmentUpdated.subject"](
    {
      channel: getChannelName(channel),
      tenant: tenant.longName,
    },
    { locale },
  );
  const address = await getAddressFromTenant(tenant.id);
  const attachments = generateAttachmentsForAppointment(
    tenant,
    channel,
    agent,
    appointment,
    address,
    locale,
  );
  const emailRender = render(AppointmentUpdated, {
    props: {
      locale,
      channel,
      user,
      tenant,
      appointment: { ...appointment, agentName: agent?.name ?? "---" },
      address,
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await sendEmail(recipient as any, subject, html, text, tenant.longName, attachments);
}

/**
 * Send appointment cancellation email
 * @param {SelectClient | SelectUser} user - Database user object or client data
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Cancelled appointment details
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentCancelledEmail(
  user: SelectClient | SelectUser,
  tenant: SelectTenant,
  appointment: SelectAppointment,
): Promise<void> {
  const channelService = await ChannelService.forTenant(tenant.id);
  const channel = await channelService.getChannelById(appointment.channelId);

  // Create recipient directly for SelectClient type, use helper for SelectUser
  const { recipient, locale } = await getRecipient(user);
  // Generate email
  const subject = m["emails.appointmentCancelled.subject"](
    {
      channel: getChannelName(channel),
      tenant: tenant.longName,
    },
    { locale },
  );
  const emailRender = render(AppointmentCancelled, {
    props: {
      locale,
      channel,
      user,
      tenant,
      appointment: { ...appointment, agentName: "---" },
      address: await getAddressFromTenant(tenant.id),
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await sendEmail(recipient as any, subject, html, text, tenant.longName);
}

/**
 * Send notification email
 * @param {SelectUser} user - Database user object or client data
 * @param {{ domain: string; longName: string }} tenant - Tenant information for branding
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendNotificationEmail(
  user: SelectUser,
  tenant: { domain: string; longName: string },
): Promise<void> {
  // Create recipient directly for SelectClient type, use helper for SelectUser
  const { recipient, locale } = await getRecipient(user);
  // Generate email
  const subject = m["emails.notification.subject"]({}, { locale });
  const emailRender = render(Notification, {
    props: {
      locale,
      user,
      dashboardUrl: dev ? `http://localhost:5173/dashboard` : `https://${tenant.domain}/dashboard`,
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await sendEmail(recipient as any, subject, html, text, tenant.longName);
}
