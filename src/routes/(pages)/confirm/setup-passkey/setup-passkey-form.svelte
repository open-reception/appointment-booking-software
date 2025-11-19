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
  import { arrayBufferToBase64, fetchChallenge, generatePasskey } from "$lib/utils/passkey";
  import { toast } from "svelte-sonner";
  import { writable, type Writable } from "svelte/store";
  import { type Infer, type SuperValidated } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { superForm } from "sveltekit-superforms/client";
  import { formSchema, type FormSchema } from "./schema";
  import { onMount } from "svelte";
  import { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";

  let {
    data,
    formId,
    onEvent,
  }: { formId: string; onEvent: EventReporter; data: { form: SuperValidated<Infer<FormSchema>> } } =
    $props();

  let tenantId: string | undefined = $state();
  let passkeyId: string | undefined = $state();
  let authenticatorData: ArrayBuffer | undefined = $state();
  let kyberKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array } | undefined = $state();

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
        await goto(ROUTES.LOGIN);
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
    // This keypair will be used to create the dbShard after authenticatorData is available
    const { KyberCrypto } = await import("$lib/crypto/utils");
    kyberKeyPair = KyberCrypto.generateKeyPair();

    const challenge = await fetchChallenge($formData.email);

    if (!challenge) {
      logger.error("Failed to fetch challenge", { email: $formData.email });
      $passkeyLoading = "error";
    } else {
      $passkeyLoading = "user";
      const passkeyResp = await generatePasskey({ ...challenge, email: $formData.email }).catch(
        (error) => {
          $passkeyLoading = "error";
          logger.error("Failed to generate passkey", { ...challenge, error });
        },
      );

      if (!passkeyResp) {
        $passkeyLoading = "error";
        logger.error("Passkey response is falsy");
        return;
      }

      // Returns ArrayBuffer that has to be converted to base64 string
      const publicKey = passkeyResp.response.getPublicKey();
      if (!publicKey) {
        $passkeyLoading = "error";
        logger.error("Failed to get public key", { email: $formData.email });
        return;
      }

      // May include device name and counter
      const authenticatorDataResp = passkeyResp.response.getAuthenticatorData();

      // Update form data with passkey info
      const publicKeyBase64 = arrayBufferToBase64(publicKey);
      const authenticatorDataBase64 = arrayBufferToBase64(authenticatorDataResp);
      $formData = {
        ...$formData,
        id: passkeyResp.id,
        publicKeyBase64,
        authenticatorDataBase64,
      };

      // Set for later use
      passkeyId = passkeyResp.id;
      authenticatorData = authenticatorDataResp;

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
    if (tenantId && passkeyId && authenticatorData && kyberKeyPair) {
      const crypto = new UnifiedAppointmentCrypto();
      return await crypto
        .storeStaffKeyPair(tenantId, $formData.userId, passkeyId, authenticatorData, kyberKeyPair)
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
      logger.error("Failed to store staff key pair", {
        tenantId,
        userId: $formData.userId,
        passkeyId,
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
    <Form.Field {form} name="publicKeyBase64" class="hidden">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.publicKeyBase64} type="hidden" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Field {form} name="authenticatorDataBase64" class="hidden">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.authenticatorDataBase64} type="hidden" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Label class="mb-2">{m["form.passkey"]()}</Label>
    <Passkey.State state={$passkeyLoading} onclick={onSetPasskey} />
  </div>
</Form.Root>
