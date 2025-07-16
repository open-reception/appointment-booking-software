import { logger } from "$lib/logger";
import { sequence } from "@sveltejs/kit/hooks";
import { startupHandle } from "./server-hooks/startupHandle";
import { corsHandle } from "./server-hooks/corsHandle";
import { loggingHandle } from "./server-hooks/loggingHandle";
import { rateLimitHandle } from "./server-hooks/rateLimitHandle";
import { secHeaderHandle } from "./server-hooks/secHeaderHandle";
import { authHandle } from "./server-hooks/authHandle";

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

export const handle = sequence(
	startupHandle,
	loggingHandle,
	rateLimitHandle,
	corsHandle,
	secHeaderHandle,
	authHandle
);
