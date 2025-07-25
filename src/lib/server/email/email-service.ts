import { sendEmail, type EmailRecipient, createEmailRecipient } from "./mailer";
import {
	templateEngine,
	type EmailTemplateType,
	type TemplateData,
	type Language
} from "./template-engine";
import type { SelectClient, SelectStaff, SelectAppointment } from "$lib/server/db/tenant-schema";
import type { SelectTenant } from "$lib/server/db/central-schema";

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
	language: Language = "de",
	tenant: SelectTenant,
	templateData: Record<string, unknown> = {}
): Promise<void> {
	const data: TemplateData = {
		recipient,
		subject,
		language,
		tenant,
		...templateData
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
 * @param {SelectClient | SelectStaff} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {string} loginUrl - URL for user to login
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendUserCreatedEmail(
	user: SelectClient | SelectStaff,
	tenant: SelectTenant,
	loginUrl: string
): Promise<void> {
	const recipient = createEmailRecipient(user);
	const language = (recipient.language as Language) || "de";
	const subject = language === "en" ? "Welcome to Open Reception" : "Willkommen bei Open Reception";

	await sendTemplatedEmail("user-created", recipient, subject, language, tenant, {
		loginUrl
	});
}

/**
 * Send informational email about PIN reset (no reset code included)
 * @param {SelectClient | SelectStaff} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendPinResetEmail(
	user: SelectClient | SelectStaff,
	tenant: SelectTenant
): Promise<void> {
	const recipient = createEmailRecipient(user);
	const language = (recipient.language as Language) || "de";
	const subject = language === "en" ? "PIN Reset Information" : "PIN zurückgesetzt";

	await sendTemplatedEmail("pin-reset", recipient, subject, language, tenant, {});
}

/**
 * Send informational email about key reset
 * @param {SelectClient | SelectStaff} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendKeyResetEmail(
	user: SelectClient | SelectStaff,
	tenant: SelectTenant
): Promise<void> {
	const recipient = createEmailRecipient(user);
	const language = (recipient.language as Language) || "de";
	const subject = language === "en" ? "Key Reset Information" : "Schlüssel zurückgesetzt";

	await sendTemplatedEmail("key-reset", recipient, subject, language, tenant, {});
}

/**
 * Send appointment reminder email
 * @param {SelectClient | SelectStaff} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Appointment details
 * @param {string} [cancelUrl] - Optional URL to cancel appointment
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentReminderEmail(
	user: SelectClient | SelectStaff,
	tenant: SelectTenant,
	appointment: SelectAppointment,
	cancelUrl?: string
): Promise<void> {
	const recipient = createEmailRecipient(user);
	const language = (recipient.language as Language) || "de";
	const subject = language === "en" ? "Appointment Reminder" : "Terminerinnerung";

	await sendTemplatedEmail("appointment-reminder", recipient, subject, language, tenant, {
		appointment,
		appointmentDate: appointment.appointmentDate,
		appointmentTime: appointment.appointmentDate, // You might want to add a separate time field
		title: appointment.title,
		description: appointment.description,
		cancelUrl
	});
}

/**
 * Send appointment confirmation email for newly created appointments
 * @param {SelectClient | SelectStaff} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Appointment details
 * @param {string} [cancelUrl] - Optional URL to cancel appointment
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentCreatedEmail(
	user: SelectClient | SelectStaff,
	tenant: SelectTenant,
	appointment: SelectAppointment,
	cancelUrl?: string
): Promise<void> {
	const recipient = createEmailRecipient(user);
	const language = (recipient.language as Language) || "de";
	const subject = language === "en" ? "Appointment Confirmed" : "Termin bestätigt";

	await sendTemplatedEmail("appointment-created", recipient, subject, language, tenant, {
		appointment,
		appointmentDate: appointment.appointmentDate,
		title: appointment.title,
		description: appointment.description,
		cancelUrl
	});
}

/**
 * Send appointment update notification email
 * @param {SelectClient | SelectStaff} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {SelectAppointment} appointment - Updated appointment details
 * @param {string} [cancelUrl] - Optional URL to cancel appointment
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendAppointmentUpdatedEmail(
	user: SelectClient | SelectStaff,
	tenant: SelectTenant,
	appointment: SelectAppointment,
	cancelUrl?: string
): Promise<void> {
	const recipient = createEmailRecipient(user);
	const language = (recipient.language as Language) || "de";
	const subject = language === "en" ? "Appointment Updated" : "Termin aktualisiert";

	await sendTemplatedEmail("appointment-updated", recipient, subject, language, tenant, {
		appointment,
		appointmentDate: appointment.appointmentDate,
		title: appointment.title,
		description: appointment.description,
		cancelUrl
	});
}

/**
 * Send registration confirmation email with one-time code
 * @param {SelectClient | SelectStaff} user - Database user object
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {string} confirmationCode - One-time confirmation code
 * @param {number} [expirationMinutes=15] - Code expiration time in minutes
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendConfirmationEmail(
	user: SelectClient | SelectStaff,
	tenant: SelectTenant,
	confirmationCode: string,
	expirationMinutes: number = 15
): Promise<void> {
	const recipient = createEmailRecipient(user);
	const language = (recipient.language as Language) || "de";
	const subject = language === "en" ? "Confirm Your Registration" : "Registrierung bestätigen";

	await sendTemplatedEmail("confirmation", recipient, subject, language, tenant, {
		confirmationCode,
		expirationMinutes
	});
}

/**
 * Send tenant administrator invitation email
 * @param {string} adminEmail - Email address of the invited administrator
 * @param {string} adminName - Name of the invited administrator
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {string} registrationUrl - URL for administrator to register
 * @param {Language} [language="de"] - Email language
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendTenantAdminInviteEmail(
	adminEmail: string,
	adminName: string,
	tenant: SelectTenant,
	registrationUrl: string,
	language: Language = "de"
): Promise<void> {
	const recipient: EmailRecipient = {
		email: adminEmail,
		name: adminName,
		language
	};
	
	const subject = language === "en" 
		? "Invitation as Tenant Administrator" 
		: "Einladung als Tenant-Administrator";

	await sendTemplatedEmail("tenant-admin-invite", recipient, subject, language, tenant, {
		registrationUrl
	});
}

/**
 * Send user invitation email for existing tenant
 * @param {string} userEmail - Email address of the invited user
 * @param {string} userName - Name of the invited user
 * @param {SelectTenant} tenant - Tenant information for branding
 * @param {string} role - Role to assign to the user (TENANT_ADMIN or STAFF) - for logging only
 * @param {string} registrationUrl - URL for user to register (contains secure invite code)
 * @param {Language} [language="de"] - Email language
 * @throws {Error} When email sending fails
 * @returns {Promise<void>}
 */
export async function sendUserInviteEmail(
	userEmail: string,
	userName: string,
	tenant: SelectTenant,
	role: "TENANT_ADMIN" | "STAFF",
	registrationUrl: string,
	language: Language = "de"
): Promise<void> {
	const recipient: EmailRecipient = {
		email: userEmail,
		name: userName,
		language
	};
	
	const subject = language === "en" 
		? `Invitation to ${tenant.longName || tenant.shortName}` 
		: `Einladung zu ${tenant.longName || tenant.shortName}`;

	await sendTemplatedEmail("user-invite", recipient, subject, language, tenant, {
		registrationUrl
	});
}
