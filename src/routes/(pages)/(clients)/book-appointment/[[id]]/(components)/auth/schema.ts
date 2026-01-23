import { m } from "$i18n/messages";
import { INSECURE_PINS } from "$lib/const/pin";
import { z } from "zod/v4";

export const formSchemaRegister = z.object({
  pin: z
    .string()
    .length(6, m["form.errors.pinLength"]())
    .regex(/^\d{6}$/, m["form.errors.pinDigitsOnly"]())
    .refine((pin) => !INSECURE_PINS.has(pin), { message: m["form.errors.pinInsecure"]() }),
});

export type FormSchemaRegister = typeof formSchemaRegister;

export const formSchemaLogin = z.object({
  pin: z
    .string()
    .length(6, m["form.errors.pinLength"]())
    .regex(/^\d{6}$/, m["form.errors.pinDigitsOnly"]()),
});

export type FormSchemaLogin = typeof formSchemaLogin;
