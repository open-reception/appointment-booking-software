import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
	email: z.string().email(m["form.errors.email"]()),
	passphrase: z.string().min(30, m["form.errors.passphrase"]()),
	language: z.enum(["de", "en"])
});

export type FormSchema = typeof formSchema;
