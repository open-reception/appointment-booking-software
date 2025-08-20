import logger from "$lib/logger";
import type { PageServerLoad } from "./$types";

const log = logger.setContext("BFF");

export const load: PageServerLoad = async (event) => {
	const confirmation: Promise<{ success: boolean; isSetup: boolean }> = event
		.fetch("/api/auth/confirm", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ token: event.params.token })
		})
		.then(async (resp) => {
			const success = resp.status < 400;
			try {
				const body = await resp.json();
				// TODO: Check if this is the first account
				const isSetup = body.isSetup ?? false;
				return { success, isSetup };
			} catch (error) {
				log.error("Unable to parse JSON from API repsonse", { path: "/confirm/[token]", error });
				return { success, isSetup: false };
			}
		});

	return {
		streaming: {
			confirmation
		}
	};
};
