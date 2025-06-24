# UniversalLogger Documentation

## Overview

The UniversalLogger is a comprehensive logging solution for the appointment booking platform that provides unified logging capabilities across both client-side (browser) and server-side (Node.js) environments. It features automatic client error forwarding to the server for centralized log management.

## Architecture

### Core Components

1. **UniversalLogger Class** (`src/lib/logger/index.ts`)

   - Environment-aware logging with automatic detection
   - Context-based log categorization
   - Consistent API across client and server environments

2. **Winston Configuration** (`src/lib/logger/winston.ts`)

   - Structured server-side logging with custom formatting
   - Environment-based log levels
   - Stack trace capture for errors

3. **Client Error Forwarding API** (`src/routes/api/log/+server.ts`)
   - HTTP endpoint for receiving client-side errors
   - Automatic context labeling for client logs
   - Error handling with fallback logging

## Key Features

### Environment Detection

The logger automatically detects the execution environment and adapts its behavior:

- **Browser Environment**: Uses console methods with emoji prefixes and forwards errors to server
- **Server Environment**: Uses Winston logger with structured formatting

### Client Error Forwarding

Client-side errors are automatically forwarded to the server for centralized logging. This includes:

- Error messages and stack traces
- Current URL context
- User agent information
- Custom metadata
- Timestamps

### Context System

The logger supports contextual categorization through the `setContext()` method:

```typescript
const logger = createLogger("ComponentName");
logger.info("This log will be tagged with ComponentName context");
```

## Usage

### Basic Setup

```typescript
import { createLogger } from "$lib/logger";

// Create a logger with context
const logger = createLogger("MyComponent");
```

### Logging Methods

```typescript
// Debug information (development only)
logger.debug("Debug message", { additionalData: "value" });

// General information
logger.info("User logged in", { userId: 123 });

// Warnings
logger.warn("Deprecated API usage", { api: "old-endpoint" });

// Errors (automatically forwarded to server when in browser)
logger.error("Failed to save data", { error: errorObject });
```

### Request Logging

The logger automatically logs HTTP requests when integrated with SvelteKit hooks:

```typescript
// Automatic request logging includes:
// - HTTP method and URL
// - Response status code
// - Response time
// - Error classification for 4xx/5xx status codes
```

## Configuration

### Environment Variables

- **Development**: Debug level logging enabled
- **Production**: Info level logging and above

### Winston Configuration

The server-side Winston logger is configured with:

- Custom timestamp format (`YYYY-MM-DD HH:mm:ss`)
- Color-coded console output
- Stack trace capture for errors
- Structured metadata formatting

## Integration Examples

### SvelteKit Component

```typescript
<script lang="ts">
  import { onMount } from "svelte";
  import { createLogger } from "$lib/logger";

  const logger = createLogger("HomePage");

  onMount(() => {
    logger.info("Page mounted successfully");

    try {
      // Some operation
    } catch (error) {
      logger.error("Operation failed", { error });
    }
  });
</script>
```

### Server-Side Hooks

```typescript
// src/hooks.server.ts
import { logger } from "$lib/logger";

export const handle = async ({ event, resolve }) => {
	const start = Date.now();
	const requestLogger = logger.setContext("REQUEST");

	try {
		const response = await resolve(event);
		const duration = Date.now() - start;

		requestLogger.info(`${event.request.method} ${event.url.pathname}`, {
			status: response.status,
			duration: `${duration}ms`
		});

		return response;
	} catch (error) {
		requestLogger.error("Request failed", { error });
		throw error;
	}
};
```

## Client Error Server Logging

One of the key features of the UniversalLogger is that **client-side errors are automatically forwarded and logged on the server**. This provides several benefits:

### Centralized Error Tracking

All errors, whether occurring on the client or server, are logged in a single location on the server, making it easier to:

- Monitor application health
- Debug issues across the full stack
- Maintain audit trails
- Analyze error patterns

### Rich Error Context

When client errors are forwarded to the server, they include:

- **URL Context**: The page where the error occurred
- **User Agent**: Browser and device information
- **Timestamps**: When the error occurred
- **Stack Traces**: Full error details
- **Custom Metadata**: Any additional context provided

### Automatic Fallback

If the client cannot reach the server to forward an error, it falls back to local console logging, ensuring no errors are lost.

## Performance Considerations

- **Lazy Loading**: Winston is only imported on the server side
- **Async Error Forwarding**: Client errors are sent asynchronously to avoid blocking UI
- **Environment Optimization**: Debug logs are only processed in development
- **Structured Logging**: Efficient JSON-based metadata handling

## Dependencies

- **winston**: ^3.17.0 - Server-side structured logging
- **SvelteKit**: Environment detection and HTTP utilities
- **Native APIs**: Fetch API for client-server communication

## Error Handling

The logger includes comprehensive error handling:

- Failed server requests for error forwarding don't crash the client
- Malformed log data is handled gracefully
- Winston errors are caught and logged to console as fallback
- Context switching errors are isolated and don't affect logging functionality

## Best Practices

1. **Use Descriptive Contexts**: Set meaningful context names for different components
2. **Include Relevant Metadata**: Add structured data to help with debugging
3. **Appropriate Log Levels**: Use debug for development, info for important events, warn for recoverable issues, error for failures
4. **Avoid Sensitive Data**: Never log passwords, tokens, or personal information
5. **Performance Awareness**: Limit debug logging in production environments
