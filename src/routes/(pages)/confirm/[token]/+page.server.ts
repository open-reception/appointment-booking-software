import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const confirmation: Promise<{ success: boolean; isSetup: boolean }> = event
		.fetch("/api/auth/confirm", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ token: event.params.token })
		})
		.then((resp) => {
			const success = resp.status < 400;
			// TODO: Check if this is the first account
			const isSetup = true;
			return { success, isSetup };
		});

	return {
		streaming: {
			confirmation
		}
	};
};
