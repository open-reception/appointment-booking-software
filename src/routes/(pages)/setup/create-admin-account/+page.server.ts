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
		const admin = await UserService.createUser(
			{
				name: "Admin",
				email: form.data.email,
				passphrase: form.data.passphrase, // Will be undefined if passkey is used
				language: form.data.language
			},
			event.url
		);

		if (form.data.passkey) {
			await UserService.addPasskey(admin.id, {
				id: form.data.passkey.id,
				publicKey: form.data.passkey.publicKey,
				counter: form.data.passkey.counter || 0,
				deviceName: form.data.passkey.deviceName || "Unknown Device"
			});
		}

		log.debug("Admin account created successfully", {
			adminId: admin.id,
			email: admin.email,
			authMethod: form.data.passkey ? "passkey" : "passphrase",
			passkeyId: form.data.passkey ? form.data.passkey.id : undefined
		});

		return { form };
	}
};
