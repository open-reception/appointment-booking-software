# Email System Documentation

> This doc is partially outdated. New templates can be viewed locally. See routes dir. Example: http://localhost:5173/local-only/e-mail-templates/user-invite Text versions are generated automatically and will be printed to console, when local page is opened.

The Open Reception appointment booking platform includes a comprehensive email system for automated communications with clients and staff members. This document provides technical details and administration guidance for managing the email system.

## Overview

The email system is built on several key components:

- **Template Engine**: Handlebars-like syntax for dynamic content
- **Multi-tenant Branding**: Customizable colors, logos, and styling per organization
- **Multi-language Support**: German (DE) and English (EN) templates
- **End-to-End Encryption**: Privacy-focused user data handling
- **SMTP Integration**: Flexible email delivery configuration

## System Architecture

### Core Components

1. **Mailer (`src/lib/server/email/mailer.ts`)**

   - SMTP transport configuration
   - Email sending functionality
   - Connection testing utilities

2. **Template Engine (`src/lib/server/email/template-engine.ts`)**

   - Template loading and rendering
   - Variable substitution
   - Conditional logic and loops
   - Language fallback support

3. **Email Service (`src/lib/server/email/email-service.ts`)**

   - High-level email functions
   - Database integration
   - Template selection logic

4. **Templates (`src/lib/server/email/templates/`)**
   - HTML and plain text templates
   - Multi-language template files
   - Tenant branding integration

## Email Template Management

### Template Structure

Email templates are stored in `src/lib/server/email/templates/` with the following naming convention:

```
{template-type}.{language}.{format}
```

**Examples:**

- `user-created.de.html` - German HTML template for user creation
- `user-created.en.txt` - English plain text template for user creation
- `appointment-reminder.de.html` - German appointment reminder

### Available Template Types

| Template Type          | Purpose                           | Required Variables         |
| ---------------------- | --------------------------------- | -------------------------- |
| `user-created`         | Welcome email for new users       | `loginUrl`                 |
| `pin-reset`            | PIN reset notification            | None                       |
| `key-reset`            | Encryption key reset notification | None                       |
| `appointment-reminder` | Appointment reminders             | `appointment`, `cancelUrl` |
| `appointment-created`  | New appointment confirmation      | `appointment`, `cancelUrl` |
| `appointment-updated`  | Appointment change notification   | `appointment`, `cancelUrl` |

### Template Syntax

Templates use a Handlebars-like syntax for dynamic content:

#### Variable Substitution

```html
<p>Hello {{recipient.name}},</p>
<p>Your appointment is on {{appointmentDate}}.</p>
```

#### Conditional Blocks

```html
{{#if tenant.logo}}
<img src="data:image/png;base64,{{tenant.logo}}" alt="{{tenant.longName}}" />
{{/if}} {{#if cancelUrl}}
<a href="{{cancelUrl}}" class="button">Cancel Appointment</a>
{{/if}}
```

#### Loops (for arrays)

```html
{{#each items}}
<li>{{item.name}}: {{item.value}}</li>
{{/each}}
```

### Available Template Variables

All templates have access to the following standard variables:

#### Recipient Information

- `{{recipient.email}}` - Email address
- `{{recipient.name}}` - Display name (staff only, clients for privacy)
- `{{recipient.language}}` - Preferred language (de/en)

#### Tenant Branding

- `{{tenant.longName}}` - Organization name
- `{{tenant.logo}}` - Base64-encoded logo image
- `{{tenant.primaryColor}}` - Primary brand color (hex)
- `{{tenant.secondaryColor}}` - Secondary brand color (hex)
- `{{tenant.backgroundColor}}` - Background color (hex)

#### Template-Specific Variables

Additional variables depend on the template type (see table above).

## Multi-Language Support

### Adding New Languages

1. **Create Template Files**

   ```bash
   # Example for French (fr)
   cp user-created.de.html user-created.fr.html
   cp user-created.de.txt user-created.fr.txt
   ```

2. **Update Language Type**

   ```typescript
   // In src/lib/server/email/template-engine.ts
   export type Language = "de" | "en" | "fr";
   ```

3. **Translate Content**
   - Update all text content to the target language
   - Maintain all template variables (`{{...}}`)
   - Test with different tenant branding

### Language Fallback

The system automatically falls back to German (DE) if a template doesn't exist in the requested language:

```
Request: user-created.fr.html
Not found → Fallback to: user-created.de.html
```

## Tenant Branding Configuration

### Brand Colors

Tenants can customize three color values that are automatically applied to email templates:

```typescript
interface TenantBranding {
  primaryColor: string; // Main brand color (buttons, links, logos)
  secondaryColor: string; // Accent color (success messages, highlights)
  backgroundColor: string; // Email background color
}
```

**Example Usage in Templates:**

```css
.logo {
  color: {{tenant.primaryColor}};
}

.button {
  background-color: {{tenant.primaryColor}};
}

.success {
  background-color: {{tenant.secondaryColor}};
}

body {
  background-color: {{tenant.backgroundColor}};
}
```

### Logo Integration

Tenant logos are stored as binary data in the database and automatically converted to base64 for email embedding:

```html
{{#if tenant.logo}}
<img
  src="data:image/png;base64,{{tenant.logo}}"
  alt="{{tenant.longName}}"
  style="max-height: 60px; margin-bottom: 10px;"
/>
{{/if}}
<div class="logo">{{tenant.longName}}</div>
```

**Supported Logo Formats:**

- PNG (recommended)
- JPEG
- GIF
- WEBP

**Recommendations:**

- Maximum size: 200x100 pixels
- Transparent backgrounds for PNG
- Optimize file size for email delivery

## SMTP Configuration

### Environment Variables

Configure email delivery through environment variables:

```bash
# Required SMTP settings
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=username@example.com
SMTP_PASS=password

# Optional sender information
SMTP_FROM_NAME="Your Organization"
SMTP_FROM_EMAIL=noreply@example.com
```

### Security Considerations

- Use TLS/SSL for SMTP connections (`SMTP_SECURE=true` for port 465)
- Store credentials securely (environment variables, secrets management)
- Consider using app-specific passwords for G-Mail/Outlook
- Implement proper SPF, DKIM, and D-MARC records

## Privacy and Data Protection

### End-to-End Encryption

The email system is designed with privacy in mind:

- **Client Emails**: Optional field, may be empty for privacy
- **Staff Emails**: Required for administrative notifications
- **No Personal Data**: Templates avoid exposing sensitive information
- **Minimal Logging**: Only delivery status is logged, not content

### Data Handling

```typescript
// Client email creation (privacy-focused)
const clientRecipient = {
  email: user.email || "", // May be empty
  name: undefined, // Never stored for clients
  language: user.language || "de",
};

// Staff email creation
const staffRecipient = {
  email: user.email, // Always required
  name: user.name || undefined, // Optional display name
  language: user.language || "de",
};
```

## Testing and Development

### Running Tests

```bash
# Run email system tests
npm run test src/lib/server/email/__tests__/email-system.test.ts

# Run all tests
npm run test
```

### Email Testing in Development

The system automatically uses test mode in development:

- No actual emails are sent
- SMTP configuration is mocked
- Template rendering is fully tested
- Console logging shows email content

### Template Development Workflow

1. **Create/Edit Templates**

   ```bash
   # Edit existing template
   vim src/lib/server/email/templates/user-created.de.html
   ```

2. **Test Template Rendering**

   ```typescript
   // Add test case in email-system.test.ts
   const result = await templateEngine.renderTemplate("user-created", {
     recipient: { email: "test@example.com", name: "Test User" },
     subject: "Test Subject",
     language: "de",
     tenant: mockTenant,
   });
   ```

3. **Validate Output**
   - Check HTML rendering
   - Verify variable substitution
   - Test conditional logic
   - Validate across languages

## Troubleshooting

### Common Issues

**Template Not Found**

```
Error: Template file not found: template-name.de.html
```

- Verify file exists in `src/lib/server/email/templates/`
- Check file naming convention
- Ensure file permissions are correct

**SMTP Connection Failed**

```
Error: SMTP configuration is incomplete
```

- Verify all required environment variables
- Test SMTP credentials manually
- Check network connectivity and firewall rules

**Variable Not Substituted**

```
Email shows: Hello {{recipient.name}}
```

- Verify variable name spelling
- Check data structure matches template expectations
- Ensure tenant object is properly passed

### Debug Mode

Enable detailed logging for email debugging:

```typescript
// In template-engine.ts, add console.log statements
console.log("Template data:", JSON.stringify(data, null, 2));
console.log("Rendered HTML:", renderedHtml);
```

## Security Best Practices

1. **Template Security**

   - Sanitize any user-generated content
   - Avoid exposing sensitive data in templates
   - Use HTTPS for all links in emails

2. **SMTP Security**

   - Use encrypted connections (TLS/SSL)
   - Rotate SMTP credentials regularly
   - Monitor for unauthorized access

3. **Data Protection**
   - Respect user privacy preferences
   - Implement proper data retention policies
   - Log minimal information for debugging

## Future Enhancements

### Extension Points

The email system is designed for extensibility:

- **New Template Types**: Add to `EmailTemplateType` enum
- **Custom Variables**: Extend `TemplateData` interface
- **Advanced Logic**: Enhance template engine syntax
- **External Services**: Integration with email service providers

## Support and Maintenance

### Regular Maintenance Tasks

1. **Monitor Delivery Rates**

   - Check SMTP logs for delivery failures
   - Monitor bounce rates and spam complaints
   - Update DNS records as needed

2. **Template Updates**

   - Review templates for brand consistency
   - Update content for policy changes
   - Test across email clients

3. **Security Updates**
   - Keep dependencies updated
   - Review SMTP security settings
   - Audit access logs

### Getting Help

For technical support or questions about the email system:

1. Check the test suite for usage examples
2. Review JSDoc comments in source code
3. Consult the main project documentation
4. Submit issues via the project repository

---

_This documentation is maintained as part of the Open Reception project. For the latest updates, refer to the project repository._
