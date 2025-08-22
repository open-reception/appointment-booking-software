import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const success: Promise<boolean> = event
		.fetch("/api/auth/logout", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			}
		})
		.then(async (resp) => {
			// TODO: Why is this failing?
			console.log("resp", resp, await resp.json());
			return resp.status < 400;
		});

	return { streaming: { success } };
};
