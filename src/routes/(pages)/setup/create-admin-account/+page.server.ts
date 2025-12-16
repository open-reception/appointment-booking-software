import logger from "$lib/logger";
import { UserService } from "$lib/server/services/user-service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types";
import { formSchema } from "./schema";

const log = logger.setContext(import.meta.filename);

export const load: PageServerLoad = async () => {
  return {
    form: await superValidate(zod(formSchema)),
  };
};

export const actions: Actions = {
  default: async (event) => {
    const form = await superValidate(event, zod(formSchema));
    if (!form.valid) {
      log.error("Create global admin form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data, type: "passkey" } },
      });
    }

    // IMPORTANT: Verify passkey BEFORE creating user to avoid orphaned users
    let verificationResult:
      | { credentialID: string; credentialPublicKey: string; counter: number }
      | undefined;

    if (form.data.type === "passkey") {
      // Validate that this registration was preceded by a challenge request
      const registrationEmail = event.cookies.get("webauthn-registration-email");
      const challengeFromSession = event.cookies.get("webauthn-challenge");

      if (!registrationEmail || registrationEmail !== form.data.email) {
        log.error("Invalid registration email cookie", {
          registrationEmail,
          formEmail: form.data.email,
        });
        return fail(400, {
          form: { ...form, data: { ...form.data, type: "passkey" } },
        });
      }

      if (!challengeFromSession) {
        log.error("Missing WebAuthn challenge");
        return fail(400, {
          form: { ...form, data: { ...form.data, type: "passkey" } },
        });
      }

      // Verify registration and extract COSE public key using @simplewebauthn/server
      try {
        verificationResult = await WebAuthnService.verifyRegistration(
          form.data.id,
          form.data.attestationObjectBase64,
          form.data.clientDataJSONBase64,
          challengeFromSession,
          event.url,
        );

        log.debug("Passkey verified successfully", {
          credentialID: verificationResult.credentialID,
          counter: verificationResult.counter,
        });
      } catch (error) {
        log.error("Passkey verification failed", { error: String(error) });
        return fail(400, {
          form: { ...form, data: { ...form.data, type: "passkey" } },
        });
      }
    }

    // Create admin account AFTER passkey verification (if applicable)
    const admin = await UserService.createUser(
      {
        name: "Admin",
        email: form.data.email,
        role: "GLOBAL_ADMIN",
        passphrase:
          form.data.type === "passphrase" && form.data.passphrase
            ? form.data.passphrase
            : undefined,
        language: form.data.language,
      },
      event.url,
    );

    // Add verified passkey to admin account
    if (form.data.type === "passkey" && verificationResult) {
      await UserService.addPasskey(admin.id, {
        id: verificationResult.credentialID,
        publicKey: verificationResult.credentialPublicKey,
        counter: verificationResult.counter,
        deviceName: "Unknown Device",
      });

      log.debug("Passkey added to admin account", {
        adminId: admin.id,
        passkeyId: verificationResult.credentialID,
        counter: verificationResult.counter,
      });
    }

    return { form };
  },
};
