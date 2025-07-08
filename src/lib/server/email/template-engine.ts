import { readFile } from "fs/promises";
import { join } from "path";
import type { EmailRecipient } from "./mailer";
import type { SelectTenant } from "$lib/server/db/schema";

/** Supported template languages */
export type Language = "de" | "en";

/**
 * Available email template types
 * @typedef {'user-created' | 'pin-reset' | 'key-reset' | 'appointment-reminder' | 'appointment-created' | 'appointment-updated'} EmailTemplateType
 */
export type EmailTemplateType =
	| "user-created"
	| "pin-reset" // Info that PIN was reset (no code)
	| "key-reset"
	| "appointment-reminder"
	| "appointment-created"
	| "appointment-updated";

/**
 * Template data interface containing all variables available in templates
 * @interface TemplateData
 * @property {EmailRecipient} recipient - Email recipient information
 * @property {string} subject - Email subject line
 * @property {Language} language - Template language (de/en)
 * @property {SelectTenant} tenant - Tenant information for branding
 * @property {unknown} [key] - Additional template variables
 */
export interface TemplateData {
	recipient: EmailRecipient;
	subject: string;
	language: Language;
	tenant: SelectTenant;
	[key: string]: unknown;
}

/**
 * Template rendering result containing rendered HTML, text, and subject
 * @interface RenderedTemplate
 * @property {string} html - Rendered HTML content
 * @property {string} text - Rendered plain text content
 * @property {string} subject - Rendered subject line
 */
export interface RenderedTemplate {
	html: string;
	text: string;
	subject: string;
}

/**
 * Email template engine with Handlebars-like syntax support
 * Supports variable substitution, conditionals, loops, and multilingual templates
 */
export class EmailTemplateEngine {
	private templatePath: string;

	/**
	 * Create a new template engine instance
	 * @param {string} templatePath - Path to template directory
	 */
	constructor(templatePath: string = "src/lib/server/email/templates") {
		this.templatePath = templatePath;
	}

	/**
	 * Render a template with the provided data
	 * @param {EmailTemplateType} templateType - Type of template to render
	 * @param {TemplateData} data - Template data and variables
	 * @returns {Promise<RenderedTemplate>} Rendered template with HTML, text, and subject
	 * @throws {Error} When template files are not found
	 */
	async renderTemplate(
		templateType: EmailTemplateType,
		data: TemplateData
	): Promise<RenderedTemplate> {
		const language = data.language || "de";
		const [htmlContent, textContent] = await Promise.all([
			this.loadTemplate(templateType, "html", language),
			this.loadTemplate(templateType, "txt", language)
		]);

		const renderedHtml = this.replaceVariables(htmlContent, data);
		const renderedText = this.replaceVariables(textContent, data);
		const renderedSubject = this.replaceVariables(data.subject, data);

		return {
			html: renderedHtml,
			text: renderedText,
			subject: renderedSubject
		};
	}

	/**
	 * Load template file with language fallback support
	 * @param {EmailTemplateType} templateType - Template type
	 * @param {'html' | 'txt'} fileType - File type to load
	 * @param {Language} language - Language preference (defaults to 'de')
	 * @returns {Promise<string>} Template file content
	 * @throws {Error} When template file is not found
	 * @private
	 */
	private async loadTemplate(
		templateType: EmailTemplateType,
		fileType: "html" | "txt",
		language: Language = "de"
	): Promise<string> {
		const fileName = `${templateType}.${language}.${fileType}`;
		const filePath = join(process.cwd(), this.templatePath, fileName);

		try {
			return await readFile(filePath, "utf-8");
		} catch (error) {
			// Fallback to German if language-specific template doesn't exist
			if (language !== "de") {
				console.warn(`Template ${fileName} not found, falling back to German`);
				return this.loadTemplate(templateType, fileType, "de");
			}
			throw new Error(`Template file not found: ${fileName}. Error: ${error}`);
		}
	}

	/**
	 * Replace variables in template content using Handlebars-like syntax
	 * Supports: {{variable}}, {{#if condition}}...{{/if}}, {{#each items}}...{{/each}}
	 * @param {string} content - Template content with variables
	 * @param {TemplateData} data - Data for variable substitution
	 * @returns {string} Content with variables replaced
	 * @private
	 */
	private replaceVariables(content: string, data: TemplateData): string {
		let result = content;

		// Replace simple variables like {{variable}}
		result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
			const value = this.getNestedValue(data, path);
			return value !== undefined ? String(value) : match;
		});

		// Replace conditional blocks like {{#if condition}}...{{/if}}
		result = result.replace(
			/\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/g,
			(match, path, block) => {
				const value = this.getNestedValue(data, path);
				return value ? block : "";
			}
		);

		// Replace loops like {{#each items}}...{{/each}}
		result = result.replace(
			/\{\{#each\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/each\}\}/g,
			(match, path, block) => {
				const items = this.getNestedValue(data, path);
				if (Array.isArray(items)) {
					return items.map((item) => this.replaceVariables(block, { ...data, item })).join("");
				}
				return "";
			}
		);

		return result;
	}

	/**
	 * Get nested value from object using dot notation (e.g., 'tenant.primaryColor')
	 * @param {TemplateData} obj - Object to search in
	 * @param {string} path - Dot-separated path to value
	 * @returns {unknown} Value at path or undefined if not found
	 * @private
	 */
	private getNestedValue(obj: TemplateData, path: string): unknown {
		return path.split(".").reduce((current: unknown, key: string) => {
			return current && typeof current === "object" && key in current
				? (current as Record<string, unknown>)[key]
				: undefined;
		}, obj);
	}
}

/** Global template engine instance */
export const templateEngine = new EmailTemplateEngine();
