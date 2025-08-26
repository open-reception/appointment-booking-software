import logger from "$lib/logger";
import { UserService } from "$lib/server/services/user-service";
import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types";
import { formSchema } from "./schema";
import { base64ToArrayBuffer, getCounterFromAuthenticatorData } from "$lib/utils/passkey";

const log = logger.setContext("Setup");

export const load: PageServerLoad = async () => {
	return {
		form: await superValidate(zod(formSchema))
	};
};

export const actions: Actions = {
	default: async (event) => {
		console.log("--- actions/default()");
		console.log("Body already used?", event.request.bodyUsed);

		const form = await superValidate(event, zod(formSchema));
		console.log("form", JSON.stringify(form.data, null, 2));
		if (!form.valid) {
			console.log("not valid", form.errors);
			return fail(400, {
				form: { ...form, data: { ...form.data, type: "passkey" } }
			});
		}

		console.log("form is valid, proceeding");
		return { form };

		// Create admin account
		const admin = await UserService.createUser(
			{
				name: "Admin",
				email: form.data.email,
				passphrase:
					form.data.type === "passphrase" && form.data.passphrase
						? form.data.passphrase
						: undefined,
				language: form.data.language
			},
			event.url
		);

		if (form.data.type === "passkey") {
			const publicKey = form.data.publicKeyBase64;
			const authenticatorData = base64ToArrayBuffer(form.data.authenticatorDataBase64);
			const counter = getCounterFromAuthenticatorData(authenticatorData);
			console.log("counter", counter);

			await UserService.addPasskey(admin.id, {
				id: form.data.id,
				publicKey: publicKey,
				counter,
				deviceName: "Unknown Device"
			});
		}

		log.debug("Admin account created successfully", {
			adminId: admin.id,
			email: admin.email,
			authMethod: form.data.type === "passkey" ? "passkey" : "passphrase",
			passkeyId: form.data.type === "passkey" ? form.data.id : undefined
		});

		return { form };
	}
};
