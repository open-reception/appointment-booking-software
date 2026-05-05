import { json } from "@sveltejs/kit";
import { logger } from "$lib/logger";

export async function POST({ request }) {
  try {
    const { level, message, meta } = await request.json();

    // Block messages that are bigger than 4KB to prevent abuse
    if (typeof message === "string" && message.length > 4096) {
      logger.warn("Blocked oversized log message from client", { length: message.length });
      return json({ success: false, error: "Message too long" }, { status: 400 });
    }

    const clientLogger = logger.setContext("CLIENT");

    const sanitizedMessage = `${message}`
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\0/g, "\\0")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x01-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");

    switch (level) {
      case "debug":
        clientLogger.debug(sanitizedMessage, meta);
        break;
      case "info":
        clientLogger.info(sanitizedMessage, meta);
        break;
      case "warn":
        clientLogger.warn(sanitizedMessage, meta);
        break;
      case "error":
        clientLogger.error(sanitizedMessage, meta);
        break;
      default:
        clientLogger.info(sanitizedMessage, meta);
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
