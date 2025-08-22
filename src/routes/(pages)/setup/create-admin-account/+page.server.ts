import logger from "$lib/logger";
import { UserService } from "$lib/server/services/user-service";
import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types";
import { formSchema } from "./schema";

const log = logger.setContext("Setup");

export const load: PageServerLoad = async () => {
	return {
		form: await superValidate(zod(formSchema))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, zod(formSchema));

		if (!form.valid) {
			return fail(400, {
				form
			});
		}

		// Create admin account
		const admin = await UserService.createUser({
			name: "Admin",
			email: form.data.email,
			passphrase: form.data.passphrase,
			language: form.data.language
		}, event.url);
		const hasPasskey = false;

		log.debug("Admin account created successfully", {
			adminId: admin.id,
			email: admin.email,
			authMethod: hasPasskey ? "passkey" : "passphrase"
			// passkeyId: hasPasskey ? body.passkey.id : undefined
		});

		return { form };
	}
};
