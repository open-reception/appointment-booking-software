import { json } from "@sveltejs/kit";
import { logger } from "$lib/logger";

export async function POST({ request }) {
	try {
		const { level, message, meta } = await request.json();

		const clientLogger = logger.setContext("CLIENT");

		switch (level) {
			case "debug":
				clientLogger.debug(message, meta);
				break;
			case "info":
				clientLogger.info(message, meta);
				break;
			case "warn":
				clientLogger.warn(message, meta);
				break;
			case "error":
				clientLogger.error(message, meta);
				break;
			default:
				clientLogger.info(message, meta);
		}

		return json({ success: true });
	} catch (error: unknown) {
		if (error instanceof Error) {
			logger.error("Failed to process client log", { error: error?.message ?? "Unknown error" });
		} else {
			logger.error("Unknown error on processing client error message");
		}
		return json({ success: false }, { status: 500 });
	}
}
