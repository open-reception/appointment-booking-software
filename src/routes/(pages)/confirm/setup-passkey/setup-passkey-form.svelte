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
  import { toast } from "svelte-sonner";
  import { writable, type Writable } from "svelte/store";
  import { type Infer, type SuperValidated } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { superForm } from "sveltekit-superforms/client";
  import { formSchema, type FormSchema } from "./schema";
  import { onMount } from "svelte";
  import { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";
  import { resolve } from "$app/paths";
  import { getPasskeyFormData } from "$lib/utils/passkey";

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
    const data = await getPasskeyFormData({
      email: $formData.email,
      userId: $formData.userId,
      setPasskeyFieldState: (v) => ($passkeyLoading = v),
      isAdditionalPasskey: false,
    });

    if (!data) {
      console.error("Unable to getPasskeyFormData");
    } else {
      passkeyId = data.passkeyId;
      kyberKeyPair = data.kyberKeyPair;
      prfOutput = data.prfOutput;

      $formData.id = data.formData.id;
      $formData.attestationObjectBase64 = data.formData.attestationObjectBase64;
      $formData.clientDataJSONBase64 = data.formData.clientDataJSONBase64;
      $formData.challenge = data.formData.challenge;
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
