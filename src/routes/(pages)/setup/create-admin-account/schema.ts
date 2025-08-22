import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z
	.object({
		email: z.string().email(m["form.errors.email"]()),
		passphrase: z.string().min(30, m["form.errors.passphrase"]()).optional(),
		passkey: z
			.object({
				id: z.string().min(10),
				publicKey: z.string().min(10),
				counter: z.number().min(0),
				deviceName: z.string().min(1).optional()
			})
			.optional(),
		language: z.enum(["de", "en"])
	})
	.refine((data) => !!data.passphrase || !!data.passkey, {
		message: m["form.errors.noPassAtAll"](),
		path: ["passphrase"]
	})
	.refine((data) => !(data.passphrase && data.passkey), {
		message: m["form.errors.bothPassSet"](),
		path: ["passphrase"]
	});

export type FormSchema = typeof formSchema;
