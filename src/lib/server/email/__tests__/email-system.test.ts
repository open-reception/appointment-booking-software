import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock environment variables
vi.mock("$env/dynamic/private", () => ({
	env: {
		SMTP_HOST: "smtp.test.com",
		SMTP_PORT: "587",
		SMTP_SECURE: "false",
		SMTP_USER: "test@example.com",
		SMTP_PASS: "test-password",
		SMTP_FROM_NAME: "Test App",
		SMTP_FROM_EMAIL: "noreply@test.com"
	}
}));

// Mock nodemailer
const mockSendMail = vi.fn();
const mockVerify = vi.fn();
const mockTransporter = {
	sendMail: mockSendMail,
	verify: mockVerify
};

vi.mock("nodemailer", () => ({
	default: {
		createTransport: vi.fn(() => mockTransporter)
	}
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
	readFile: vi.fn()
}));

// Import modules after mocking
import { sendEmail, testEmailConnection } from "../mailer";
import { EmailTemplateEngine } from "../template-engine";
import { sendUserCreatedEmail, sendTemplatedEmail, sendConfirmationEmail } from "../email-service";
import { readFile } from "fs/promises";
import nodemailer from "nodemailer";

const mockReadFile = vi.mocked(readFile);
const mockCreateTransporter = vi.mocked(nodemailer.createTransport);

describe("Email System", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSendMail.mockResolvedValue({ messageId: "test-message-id" });
		mockVerify.mockResolvedValue(true);
	});

	describe("Mailer", () => {
		it("should send email successfully", async () => {
			const recipient = { email: "test@example.com", name: "Test User" };
			const subject = "Test Subject";
			const htmlContent = "<h1>Test HTML</h1>";
			const textContent = "Test Text";

			await sendEmail(recipient, subject, htmlContent, textContent);

			expect(mockCreateTransporter).toHaveBeenCalledWith({
				host: "smtp.test.com",
				port: 587,
				secure: false,
				auth: {
					user: "test@example.com",
					pass: "test-password"
				}
			});

			expect(mockSendMail).toHaveBeenCalledWith({
				from: {
					name: "Test App",
					address: "noreply@test.com"
				},
				to: {
					name: "Test User",
					address: "test@example.com"
				},
				subject: "Test Subject",
				html: "<h1>Test HTML</h1>",
				text: "Test Text"
			});
		});

		it("should test email connection", async () => {
			const result = await testEmailConnection();
			expect(result).toBe(true);
			expect(mockVerify).toHaveBeenCalled();
		});
	});

	describe("Template Engine", () => {
		let templateEngine: EmailTemplateEngine;

		beforeEach(() => {
			templateEngine = new EmailTemplateEngine("test/templates");
		});

		it("should render template with variables", async () => {
			const mockHtml = "<h1>Hello {{recipient.name}}</h1>";
			const mockText = "Hello {{recipient.name}}";

			mockReadFile.mockResolvedValueOnce(mockHtml).mockResolvedValueOnce(mockText);

			const mockTenant = {
				id: "tenant-1",
				shortName: "test",
				longName: "Test Organization",
				description: null,
				logo: null,
				backgroundColor: "#f0f0f0",
				primaryColor: "#007bff",
				secondaryColor: "#28a745",
				defaultLanguage: "de",
				autoDeleteDays: 365,
				requireConfirmation: false
			};

			const result = await templateEngine.renderTemplate("user-created", {
				recipient: { email: "test@example.com", name: "Test User" },
				subject: "Test Subject",
				language: "de",
				tenant: mockTenant
			});

			expect(result.html).toBe("<h1>Hello Test User</h1>");
			expect(result.text).toBe("Hello Test User");
			expect(result.subject).toBe("Test Subject");
		});

		it("should handle conditional blocks", async () => {
			const mockHtml = "{{#if showButton}}<button>Click</button>{{/if}}";
			const mockText = "{{#if showButton}}Button available{{/if}}";

			mockReadFile.mockResolvedValueOnce(mockHtml).mockResolvedValueOnce(mockText);

			const mockTenant = {
				id: "tenant-1",
				shortName: "test",
				longName: "Test Organization",
				description: null,
				logo: null,
				backgroundColor: "#f0f0f0",
				primaryColor: "#007bff",
				secondaryColor: "#28a745",
				defaultLanguage: "de",
				autoDeleteDays: 365,
				requireConfirmation: false
			};

			const result = await templateEngine.renderTemplate("user-created", {
				recipient: { email: "test@example.com" },
				subject: "Test",
				language: "de",
				tenant: mockTenant,
				showButton: true
			});

			expect(result.html).toBe("<button>Click</button>");
			expect(result.text).toBe("Button available");
		});

		it("should handle missing conditionals", async () => {
			const mockHtml = "{{#if showButton}}<button>Click</button>{{/if}}";
			const mockText = "{{#if showButton}}Button available{{/if}}";

			mockReadFile.mockResolvedValueOnce(mockHtml).mockResolvedValueOnce(mockText);

			const mockTenant = {
				id: "tenant-1",
				shortName: "test",
				longName: "Test Organization",
				description: null,
				logo: null,
				backgroundColor: "#f0f0f0",
				primaryColor: "#007bff",
				secondaryColor: "#28a745",
				defaultLanguage: "de",
				autoDeleteDays: 365,
				requireConfirmation: false
			};

			const result = await templateEngine.renderTemplate("user-created", {
				recipient: { email: "test@example.com" },
				subject: "Test",
				language: "de",
				tenant: mockTenant,
				showButton: false
			});

			expect(result.html).toBe("");
			expect(result.text).toBe("");
		});

		it("should handle English language", async () => {
			const mockHtml = "<h1>Welcome {{recipient.name}}</h1>";
			const mockText = "Welcome {{recipient.name}}";

			mockReadFile.mockResolvedValueOnce(mockHtml).mockResolvedValueOnce(mockText);

			const mockTenant = {
				id: "tenant-1",
				shortName: "test",
				longName: "Test Organization",
				description: null,
				logo: null,
				backgroundColor: "#f0f0f0",
				primaryColor: "#007bff",
				secondaryColor: "#28a745",
				defaultLanguage: "de",
				autoDeleteDays: 365,
				requireConfirmation: false
			};

			const result = await templateEngine.renderTemplate("user-created", {
				recipient: { email: "test@example.com", name: "John Doe" },
				subject: "Welcome",
				language: "en",
				tenant: mockTenant
			});

			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining("user-created.en.html"),
				"utf-8"
			);
			expect(result.html).toBe("<h1>Welcome John Doe</h1>");
		});
	});

	describe("Email Service", () => {
		it("should send user created email in German", async () => {
			const mockHtml = "<h1>Willkommen {{recipient.name}}</h1>";
			const mockText = "Willkommen {{recipient.name}}";

			mockReadFile.mockResolvedValueOnce(mockHtml).mockResolvedValueOnce(mockText);

			// Create a mock staff user with German language
			const staffUser = {
				id: "test-id",
				hashKey: "test-hash",
				publicKey: "test-key",
				name: "Max Mustermann",
				position: "Arzt",
				email: "test@example.com",
				language: "de"
			};
			const mockTenant = {
				id: "tenant-1",
				shortName: "test",
				longName: "Test Organization",
				description: null,
				logo: null,
				backgroundColor: "#f0f0f0",
				primaryColor: "#007bff",
				secondaryColor: "#28a745",
				defaultLanguage: "de",
				autoDeleteDays: 365,
				requireConfirmation: false
			};
			const loginUrl = "https://app.example.com/login";

			await sendUserCreatedEmail(staffUser, mockTenant, loginUrl);

			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining("user-created.de.html"),
				"utf-8"
			);

			expect(mockSendMail).toHaveBeenCalledWith({
				from: {
					name: "Test App",
					address: "noreply@test.com"
				},
				to: {
					name: "Max Mustermann",
					address: "test@example.com"
				},
				subject: "Willkommen bei Open Reception",
				html: "<h1>Willkommen Max Mustermann</h1>",
				text: "Willkommen Max Mustermann"
			});
		});

		it("should send user created email in English", async () => {
			const mockHtml = "<h1>Welcome {{recipient.name}}</h1>";
			const mockText = "Welcome {{recipient.name}}";

			mockReadFile.mockResolvedValueOnce(mockHtml).mockResolvedValueOnce(mockText);

			// Create a mock staff user with English language
			const staffUser = {
				id: "test-id",
				hashKey: "test-hash",
				publicKey: "test-key",
				name: "John Doe",
				position: "Doctor",
				email: "test@example.com",
				language: "en"
			};
			const mockTenant = {
				id: "tenant-1",
				shortName: "test",
				longName: "Test Organization",
				description: null,
				logo: null,
				backgroundColor: "#f0f0f0",
				primaryColor: "#007bff",
				secondaryColor: "#28a745",
				defaultLanguage: "de",
				autoDeleteDays: 365,
				requireConfirmation: false
			};
			const loginUrl = "https://app.example.com/login";

			await sendUserCreatedEmail(staffUser, mockTenant, loginUrl);

			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining("user-created.en.html"),
				"utf-8"
			);

			expect(mockSendMail).toHaveBeenCalledWith({
				from: {
					name: "Test App",
					address: "noreply@test.com"
				},
				to: {
					name: "John Doe",
					address: "test@example.com"
				},
				subject: "Welcome to Open Reception",
				html: "<h1>Welcome John Doe</h1>",
				text: "Welcome John Doe"
			});
		});

		it("should handle template rendering errors", async () => {
			mockReadFile.mockRejectedValue(new Error("Template not found"));

			const recipient = { email: "test@example.com" };
			const mockTenant = {
				id: "tenant-1",
				shortName: "test",
				longName: "Test Organization",
				description: null,
				logo: null,
				backgroundColor: "#f0f0f0",
				primaryColor: "#007bff",
				secondaryColor: "#28a745",
				defaultLanguage: "de",
				autoDeleteDays: 365,
				requireConfirmation: false
			};

			await expect(
				sendTemplatedEmail("user-created", recipient, "Test", "de", mockTenant, {})
			).rejects.toThrow("Template not found");
		});

		it("should handle SMTP errors", async () => {
			const mockHtml = "<h1>Test</h1>";
			const mockText = "Test";

			mockReadFile.mockResolvedValueOnce(mockHtml).mockResolvedValueOnce(mockText);

			mockSendMail.mockRejectedValueOnce(new Error("SMTP Error"));

			const clientUser = {
				id: "test-id",
				hashKey: "test-hash",
				publicKey: "test-key",
				privateKeyShare: "test-share",
				email: "test@example.com",
				language: "de"
			};
			const mockTenant = {
				id: "tenant-1",
				shortName: "test",
				longName: "Test Organization",
				description: null,
				logo: null,
				backgroundColor: "#f0f0f0",
				primaryColor: "#007bff",
				secondaryColor: "#28a745",
				defaultLanguage: "de",
				autoDeleteDays: 365,
				requireConfirmation: false
			};

			await expect(
				sendUserCreatedEmail(clientUser, mockTenant, "https://example.com/login")
			).rejects.toThrow("Failed to send email to test@example.com");
		});

		it("should send confirmation email in German", async () => {
			const mockHtml = "<h1>Bestätigungscode: {{confirmationCode}}</h1><p>Gültig für {{expirationMinutes}} Minuten</p>";
			const mockText = "Bestätigungscode: {{confirmationCode}} - Gültig für {{expirationMinutes}} Minuten";

			mockReadFile.mockResolvedValueOnce(mockHtml).mockResolvedValueOnce(mockText);

			const staffUser = {
				id: "test-id",
				hashKey: "test-hash",
				publicKey: "test-key",
				name: "Max Mustermann",
				position: "Arzt",
				email: "test@example.com",
				language: "de"
			};
			const mockTenant = {
				id: "tenant-1",
				shortName: "test",
				longName: "Test Organization",
				description: null,
				logo: null,
				backgroundColor: "#f0f0f0",
				primaryColor: "#007bff",
				secondaryColor: "#28a745",
				defaultLanguage: "de",
				autoDeleteDays: 365,
				requireConfirmation: false
			};
			const confirmationCode = "ABC123";
			const expirationMinutes = 15;

			await sendConfirmationEmail(staffUser, mockTenant, confirmationCode, expirationMinutes);

			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining("confirmation.de.html"),
				"utf-8"
			);

			expect(mockSendMail).toHaveBeenCalledWith({
				from: {
					name: "Test App",
					address: "noreply@test.com"
				},
				to: {
					name: "Max Mustermann",
					address: "test@example.com"
				},
				subject: "Registrierung bestätigen",
				html: "<h1>Bestätigungscode: ABC123</h1><p>Gültig für 15 Minuten</p>",
				text: "Bestätigungscode: ABC123 - Gültig für 15 Minuten"
			});
		});

		it("should send confirmation email in English", async () => {
			const mockHtml = "<h1>Confirmation code: {{confirmationCode}}</h1><p>Valid for {{expirationMinutes}} minutes</p>";
			const mockText = "Confirmation code: {{confirmationCode}} - Valid for {{expirationMinutes}} minutes";

			mockReadFile.mockResolvedValueOnce(mockHtml).mockResolvedValueOnce(mockText);

			const staffUser = {
				id: "test-id",
				hashKey: "test-hash",
				publicKey: "test-key",
				name: "John Doe",
				position: "Doctor",
				email: "test@example.com",
				language: "en"
			};
			const mockTenant = {
				id: "tenant-1",
				shortName: "test",
				longName: "Test Organization",
				description: null,
				logo: null,
				backgroundColor: "#f0f0f0",
				primaryColor: "#007bff",
				secondaryColor: "#28a745",
				defaultLanguage: "de",
				autoDeleteDays: 365,
				requireConfirmation: false
			};
			const confirmationCode = "XYZ789";
			const expirationMinutes = 10;

			await sendConfirmationEmail(staffUser, mockTenant, confirmationCode, expirationMinutes);

			expect(mockReadFile).toHaveBeenCalledWith(
				expect.stringContaining("confirmation.en.html"),
				"utf-8"
			);

			expect(mockSendMail).toHaveBeenCalledWith({
				from: {
					name: "Test App",
					address: "noreply@test.com"
				},
				to: {
					name: "John Doe",
					address: "test@example.com"
				},
				subject: "Confirm Your Registration",
				html: "<h1>Confirmation code: XYZ789</h1><p>Valid for 10 minutes</p>",
				text: "Confirmation code: XYZ789 - Valid for 10 minutes"
			});
		});

		it("should handle confirmation template rendering", async () => {
			const mockHtml = "Code: {{confirmationCode}}";
			const mockText = "Code: {{confirmationCode}}";

			mockReadFile.mockResolvedValueOnce(mockHtml).mockResolvedValueOnce(mockText);

			const templateEngine = new EmailTemplateEngine("test/templates");
			const mockTenant = {
				id: "tenant-1",
				shortName: "test",
				longName: "Test Organization",
				description: null,
				logo: null,
				backgroundColor: "#f0f0f0",
				primaryColor: "#007bff",
				secondaryColor: "#28a745",
				defaultLanguage: "de",
				autoDeleteDays: 365,
				requireConfirmation: false
			};

			const result = await templateEngine.renderTemplate("confirmation", {
				recipient: { email: "test@example.com", name: "Test User" },
				subject: "Test Confirmation",
				language: "de",
				tenant: mockTenant,
				confirmationCode: "TEST123",
				expirationMinutes: 15
			});

			expect(result.html).toBe("Code: TEST123");
			expect(result.text).toBe("Code: TEST123");
		});
	});
});
