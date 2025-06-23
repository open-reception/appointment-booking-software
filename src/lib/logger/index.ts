import { browser } from "$app/environment";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let winstonLogger: any = undefined;
if (!browser) {
	const { default: winston } = await import("./winston");
	winstonLogger = winston;
}

class UniversalLogger {
	#context: string = "";

	setContext(context: string) {
		this.#context = context;
		return this;
	}

	#formatMessage(message: string, meta = {}) {
		const contextPrefix = this.#context ? `[${this.#context}] ` : "";
		return {
			message: `${contextPrefix}${message}`,
			...meta,
			source: browser ? "client" : "server",
			userAgent: browser ? navigator.userAgent : undefined,
			timestamp: new Date().toISOString()
		};
	}

	debug(message: string, meta = {}) {
		if (browser) {
			console.debug(`🐛 ${this.#context ? `[${this.#context}] ` : ""}${message}`, meta);
		} else {
			winstonLogger.debug(this.#formatMessage(message, meta));
		}
	}

	info(message: string, meta = {}) {
		if (browser) {
			console.info(`ℹ️ ${this.#context ? `[${this.#context}] ` : ""}${message}`, meta);
		} else {
			winstonLogger.info(this.#formatMessage(message, meta));
		}
	}

	warn(message: string, meta = {}) {
		if (browser) {
			console.warn(`⚠️ ${this.#context ? `[${this.#context}] ` : ""}${message}`, meta);
		} else {
			winstonLogger.warn(this.#formatMessage(message, meta));
		}
	}

	error(message: string, meta = {}) {
		if (browser) {
			console.error(`❌ ${this.#context ? `[${this.#context}] ` : ""}${message}`, meta);

			this.#sendErrorToServer(message, meta);
		} else {
			winstonLogger.error(this.#formatMessage(message, meta));
		}
	}

	async #sendErrorToServer(message: string, meta = {}) {
		try {
			await fetch("/api/log", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					level: "error",
					message,
					meta: {
						...meta,
						context: this.#context,
						url: window.location.href,
						userAgent: navigator.userAgent,
						timestamp: new Date().toISOString()
					}
				})
			});
		} catch (err) {
			console.error("Failed to send error to server:", err);
		}
	}

	logRequest(request: Request, responseTime: number, statusCode: number) {
		const message = `${request.method} ${request.url} - ${statusCode} (${responseTime}ms)`;

		if (statusCode >= 400) {
			this.error(message, {
				method: request.method,
				url: request.url,
				statusCode,
				responseTime
			});
		} else {
			this.info(message, {
				method: request.method,
				url: request.url,
				statusCode,
				responseTime
			});
		}
	}
}

export const logger = new UniversalLogger();

export const createLogger = (context: string) => {
	return new UniversalLogger().setContext(context);
};

export default logger;
