import type { Handle } from "@sveltejs/kit";
import { StartupService } from "$lib/server/services/startup-service";
import { UniversalLogger } from "$lib/logger";

const logger = new UniversalLogger().setContext("StartupHandle");

// Promise to ensure initialization happens only once
let initializationPromise: Promise<void> | null = null;

export const startupHandle: Handle = async ({ event, resolve }) => {
	// Initialize the application on first request
	if (!initializationPromise) {
		logger.info("Initializing application on first request");
		initializationPromise = StartupService.initialize();
	}

	// Wait for initialization to complete
	try {
		await initializationPromise;
	} catch (error) {
		logger.error("Application initialization failed", { error: String(error) });
		// Return a 503 Service Unavailable response
		return new Response("Service temporarily unavailable. Please try again later.", {
			status: 503,
			headers: {
				"Content-Type": "text/plain",
				"Retry-After": "30"
			}
		});
	}

	// Continue with the request
	return resolve(event);
};
