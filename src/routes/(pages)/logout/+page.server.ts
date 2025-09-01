import { auth } from "$lib/stores/auth";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const success: Promise<boolean> = event
		.fetch("/api/auth/logout", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			credentials: "same-origin"
		})
		.then(async (resp) => {
			return resp.status < 400;
		});

	auth.reset();

	return { streaming: { success } };
};
