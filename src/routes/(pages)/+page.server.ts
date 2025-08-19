import { ROUTES } from "$lib/const/routes.js";
import { UserService } from "$lib/server/services/user-service";
import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	// Check if global admin exists
	// If not, redirect to setup page
	const adminExists = await UserService.adminExists();
	if (!adminExists) {
		redirect(302, ROUTES.SETUP.MAIN);
	}

	// Dummy placeholder for streaming data
	const fetchEnvOk = async () => {
		const response = await event.fetch("/api/env");
		try {
			return (await response.json()).envOkay;
		} catch {
			return false;
		}
	};

	return {
		streamed: {
			isEnvOk: fetchEnvOk()
		}
	};
};
