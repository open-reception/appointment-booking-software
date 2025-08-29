import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types";
import { formSchema } from "./schema";
import type { WebAuthnCredential } from "$lib/server/auth/webauthn-service";

export const load: PageServerLoad = async () => {
	return {
		form: await superValidate(zod(formSchema))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, zod(formSchema));

		if (!form.valid) {
			if (!form.valid) {
				return fail(400, {
					form: { ...form, data: { ...form.data, type: "passkey" } }
				});
			}
		}

		let body: { credential?: WebAuthnCredential; email: string; passphrase?: string } = {
			email: form.data.email
		};
		if (form.data.type === "passphrase") {
			body = { ...body, passphrase: form.data.passphrase };
		}

		if (form.data.type === "passkey") {
			body = {
				...body,
				credential: {
					id: form.data.id,
					response: {
						clientDataJSON: form.data.clientDataBase64,
						authenticatorData: form.data.authenticatorDataBase64,
						signature: form.data.signatureBase64
					}
				}
			};
		}

		const resp = await event.fetch("/api/auth/login", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body)
		});

		if (resp.status < 400) {
			return { form };
		} else {
			return fail(400, {
				form
			});
		}
	}
};
