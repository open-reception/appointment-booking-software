<script lang="ts">
  import { goto } from "$app/navigation";
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Passkey } from "$lib/components/ui/passkey";
  import type { PasskeyState } from "$lib/components/ui/passkey/state.svelte";
  import { ROUTES } from "$lib/const/routes";
  import logger from "$lib/logger";
  import {
    arrayBufferToBase64,
    fetchChallenge,
    generatePasskey,
    getPRFOutputAfterRegistration,
  } from "$lib/utils/passkey";
  import { toast } from "svelte-sonner";
  import { writable, type Writable } from "svelte/store";
  import { type Infer, type SuperValidated } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { superForm } from "sveltekit-superforms/client";
  import { formSchema, type FormSchema } from "./schema";
  import { onMount } from "svelte";
  import { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";
  import { resolve } from "$app/paths";

  let {
    data,
    formId,
    onEvent,
  }: { formId: string; onEvent: EventReporter; data: { form: SuperValidated<Infer<FormSchema>> } } =
    $props();

  let tenantId: string | undefined = $state();
  let passkeyId: string | undefined = $state();
  let prfOutput: ArrayBuffer | undefined = $state();
  let kyberKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array } | undefined = $state();
  let registrationChallenge: string | undefined = $state();

  // svelte-ignore state_referenced_locally
  const form = superForm(data.form, {
    validators: zodClient(formSchema),
    onChange: (event) => {
      if (event.paths.includes("email")) {
        setProperPasskeyState();
      }
    },
    onResult: async (event) => {
      if (event.result.type === "success") {
        toast.success(m["setupPasskey.success"]());
        await storeStaffKeyPair();
        await goto(resolve(ROUTES.LOGIN));
      } else {
        toast.error(m["setupPasskey.error"]());
      }

      onEvent({ isSubmitting: false });
    },
    onSubmit: () => onEvent({ isSubmitting: true }),
  });

  const { form: formData, enhance } = form;
  const passkeyLoading: Writable<PasskeyState> = writable("initial");

  const setProperPasskeyState = () => {
    const isOk = formSchema.shape.email.safeParse($formData.email).success;
    if (isOk) {
      $passkeyLoading = "click";
    } else {
      $passkeyLoading = "initial";
    }
  };

  const onSetPasskey = async () => {
    $passkeyLoading = "loading";

    // Generate Kyber keypair BEFORE passkey registration
    // This keypair will be used to create the dbShard after PRF output is available
    const { KyberCrypto } = await import("$lib/crypto/utils");
    kyberKeyPair = KyberCrypto.generateKeyPair();

    const challenge = await fetchChallenge($formData.email);

    if (!challenge) {
      logger.error("Failed to fetch challenge", { email: $formData.email });
      $passkeyLoading = "error";
    } else {
      // Store the registration challenge - will be sent with form to avoid cookie overwrite by PRF challenge
      registrationChallenge = challenge.challenge;

      $passkeyLoading = "user";
      const passkeyResp = await generatePasskey({
        ...challenge,
        email: $formData.email,
        enablePRF: true, // CRITICAL: Enable PRF extension for zero-knowledge key derivation
      }).catch((error) => {
        $passkeyLoading = "error";
        logger.error("Failed to generate passkey", { ...challenge, error });
      });

      if (!passkeyResp) {
        $passkeyLoading = "error";
        logger.error("Passkey response is falsy");
        return;
      }

      // Verify PRF extension is enabled
      const extensionResults = passkeyResp.getClientExtensionResults();
      if (!extensionResults.prf?.enabled) {
        $passkeyLoading = "error";
        logger.error("PRF extension not enabled - passkey rejected", {
          email: $formData.email,
          extensions: extensionResults,
        });
        toast.warning(m["setupPasskey.errorAuthenticatorNotSupported"]());
        return;
      }

      // Get attestationObject and clientDataJSON for @simplewebauthn/server verification
      const attestationObjectResp = passkeyResp.response.attestationObject;
      const clientDataJSONResp = passkeyResp.response.clientDataJSON;

      // UX Primer for second passkey UI
      const isConfirmed = confirm(m["setupPasskey.confirmPrfRetrival"]());
      if (!isConfirmed) {
        $passkeyLoading = "error";
        toast.error(m["setupPasskey.errorPrfOutputNotTriggered"]());
        logger.warn("PRF challenge primer not confirmed");
        return;
      }

      // CRITICAL: Get PRF output immediately after passkey creation
      // This is the only time we can retrieve the PRF output
      // Uses email as salt for multi-passkey support
      try {
        const prfChallenge = await fetchChallenge($formData.email);
        if (!prfChallenge) {
          throw new Error("Failed to fetch PRF challenge");
        }

        const prfOutputResp = await getPRFOutputAfterRegistration({
          passkeyId: passkeyResp.id,
          rpId: prfChallenge.id,
          challengeBase64: prfChallenge.challenge,
          email: $formData.email, // Use email as PRF salt for multi-passkey support
        });

        prfOutput = prfOutputResp;
        logger.info("PRF output retrieved successfully", {
          passkeyId: passkeyResp.id,
          prfOutputLength: prfOutputResp.byteLength,
        });
      } catch (error) {
        $passkeyLoading = "error";
        logger.error("Failed to get PRF output", {
          email: $formData.email,
          passkeyId: passkeyResp.id,
          error,
        });
        toast.error(m["setupPasskey.errorGettingPrfOutput"]());
        return;
      }

      // Update form data with passkey info - send full attestation for proper COSE key extraction
      const attestationObjectBase64 = arrayBufferToBase64(attestationObjectResp);
      const clientDataJSONBase64 = arrayBufferToBase64(clientDataJSONResp);
      $formData = {
        ...$formData,
        id: passkeyResp.id,
        attestationObjectBase64,
        clientDataJSONBase64,
        challenge: registrationChallenge!, // Send original registration challenge (not PRF challenge)
      };

      // Set for later use
      passkeyId = passkeyResp.id;

      // Update UI to show passkey is ready
      $passkeyLoading = "success";
    }
  };

  onMount(() => {
    const navState = history.state["sveltekit:states"];
    if (navState?.id && navState?.email) {
      $formData = {
        ...$formData,
        userId: navState.id,
        email: navState.email,
      };
      tenantId = navState.tenantId;
      history.replaceState({}, "");
    }
  });

  const storeStaffKeyPair = async () => {
    if (tenantId && passkeyId && prfOutput && kyberKeyPair) {
      const crypto = new UnifiedAppointmentCrypto();
      return await crypto
        .storeStaffKeyPair(tenantId, $formData.userId, passkeyId, prfOutput, kyberKeyPair)
        .then(() => {
          toast.success(m["setupPasskey.successKeyPairSaved"]());
        })
        .catch((error) => {
          toast.error(m["setupPasskey.errorKeyPairNotSaved"]());
          logger.error("Failed to store staff key pair", {
            tenantId,
            userId: $formData.userId,
            passkeyId,
            error,
          });
        });
    } else {
      logger.error("Failed to store staff key pair - missing required data", {
        tenantId,
        userId: $formData.userId,
        passkeyId,
        hasPrfOutput: !!prfOutput,
        hasKyberKeyPair: !!kyberKeyPair,
      });
      toast.error(m["setupPasskey.errorKeyPairDataMissing"]());
    }
  };
</script>

<Form.Root {formId} {enhance}>
  <Form.Field {form} name="email">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.email"]()}</Form.Label>
        <Input {...props} bind:value={$formData.email} type="email" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <div>
    <Form.Field {form} name="userId" class="hidden">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.userId} type="hidden" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Field {form} name="id" class="hidden">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.id} type="hidden" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Field {form} name="attestationObjectBase64" class="hidden">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.attestationObjectBase64} type="hidden" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Field {form} name="clientDataJSONBase64" class="hidden">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.clientDataJSONBase64} type="hidden" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Field {form} name="challenge" class="hidden">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.challenge} type="hidden" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Label class="mb-2">{m["form.passkey"]()}</Label>
    <Passkey.State state={$passkeyLoading} onclick={onSetPasskey} />
  </div>
</Form.Root>
