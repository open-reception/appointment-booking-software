import { logger } from "$lib/logger";

export async function handle({ event, resolve }) {
	const start = Date.now();
	const requestLogger = logger.setContext("REQUEST");

	requestLogger.info(`Incoming ${event.request.method} ${event.url.pathname}`);

	const response = await resolve(event);
	const responseTime = Date.now() - start;

	requestLogger.logRequest(event.request, responseTime, response.status);

	return response;
}

type Error = {
	message?: string;
	stack?: string;
};

export async function handleError({ error, event, status, message }) {
	const errorLogger = logger.setContext("ERROR_HANDLER");

	errorLogger.error("Unhandled error occurred", {
		error: (error as Error).message,
		stack: (error as Error).stack,
		status,
		message,
		url: event.url.pathname,
		method: event.request.method,
		userAgent: event.request.headers.get("user-agent"),
		ip: event.getClientAddress()
	});

	return {
		message: "Internal server error occurred"
	};
}
