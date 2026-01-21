<script lang="ts">
  import { goto } from "$app/navigation";
  import { m } from "$i18n/messages.js";
  import { getLocale } from "$i18n/runtime.js";
  import { Button } from "$lib/components/ui/button";
  import * as Form from "$lib/components/ui/form";
  import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
  import { Input } from "$lib/components/ui/input";
  import { Passkey } from "$lib/components/ui/passkey";
  import { ROUTES } from "$lib/const/routes";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { writable, type Writable } from "svelte/store";
  import { type Infer, type SuperValidated } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { superForm } from "sveltekit-superforms/client";
  import { baseSchema, formSchema, type FormSchema } from "./schema";
  import { Text } from "$lib/components/ui/typography";
  import { Label } from "$lib/components/ui/label";
  import type { PasskeyState } from "$lib/components/ui/passkey/state.svelte";
  import { arrayBufferToBase64, fetchChallenge, generatePasskey } from "$lib/utils/passkey";
  import logger from "$lib/logger";

  let {
    data,
    formId,
    onEvent,
  }: { formId: string; onEvent: EventReporter; data: { form: SuperValidated<Infer<FormSchema>> } } =
    $props();

  // svelte-ignore state_referenced_locally
  const form = superForm($state.snapshot(data.form), {
    validators: zodClient(formSchema),
    onChange: (event) => {
      if (event.paths.includes("email")) {
        setProperPasskeyState();
      }
    },
    onResult: async (event) => {
      if (event.result.type === "success") {
        toast.success(m["setup.create_admin_account.success"]());
        await goto(ROUTES.SETUP.CHECK_EMAIL, {
          state: { email: event.result.data?.form.data.email },
        });
      }

      onEvent({ isSubmitting: false });
    },
    onSubmit: () => onEvent({ isSubmitting: true }),
  });

  const { form: formData, enhance } = form;
  const passkeyLoading: Writable<PasskeyState> = writable("initial");

  onMount(() => {
    $formData.type = "passkey";
    if (!$formData.language) {
      $formData.language = getLocale() ?? "en";
    }
  });

  const setProperPasskeyState = () => {
    const isOk = baseSchema.shape.email.safeParse($formData.email).success;
    if (isOk) {
      $passkeyLoading = "click";
    } else {
      $passkeyLoading = "initial";
    }
  };

  const onToggle = () => {
    if ($formData.type === "passkey") {
      $formData = {
        ...$formData,
        type: "passphrase",
        passphrase: "",
      };
    } else {
      $formData = {
        ...$formData,
        type: "passkey",
        id: "",
        attestationObjectBase64: "",
        clientDataJSONBase64: "",
      };
      setProperPasskeyState();
    }
  };

  const onSetPasskey = async () => {
    $passkeyLoading = "loading";
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

      // Get attestationObject and clientDataJSON for @simplewebauthn/server verification
      const attestationObjectResp = passkeyResp.response.attestationObject;
      const clientDataJSONResp = passkeyResp.response.clientDataJSON;

      // Update form data with passkey info - send full attestation for proper COSE key extraction
      const attestationObjectBase64 = arrayBufferToBase64(attestationObjectResp);
      const clientDataJSONBase64 = arrayBufferToBase64(clientDataJSONResp);
      $formData = {
        ...$formData,
        type: "passkey",
        id: passkeyResp.id,
        attestationObjectBase64,
        clientDataJSONBase64,
      };

      // Update UI to show passkey is ready
      $passkeyLoading = "success";
    }
  };

  type FormDataPassphrase = Extract<typeof $formData, { type: "passphrase" }>;
  type FormDataPasskey = Extract<typeof $formData, { type: "passkey" }>;
</script>

<Form.Root {formId} {enhance}>
  <Form.Field {form} name="type" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.type} type="text" />
      {/snippet}
    </Form.Control>
  </Form.Field>
  <Form.Field {form} name="language" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.language} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>
  <Form.Field {form} name="email">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.email"]()}</Form.Label>
        <Input {...props} bind:value={$formData.email} type="email" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  {#if $formData.type === "passphrase"}
    <Form.Field {form} name="passphrase">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["form.passphrase"]()}</Form.Label>
          <!-- prettier-ignore -->
          <Input
						{...props}
						bind:value={($formData as FormDataPassphrase).passphrase}
						type="password"
						minlength={30}
						maxlength={100}
					/>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
      <Form.Description>
        {m["form.passphraseRequirements"]()}
        {m["login.or"]()}
        <Button variant="link" size="sm" onclick={onToggle} class="text-inherit">
          {m["login.usePasskey"]()}
        </Button>.
      </Form.Description>
    </Form.Field>
  {/if}
  {#if $formData.type === "passkey"}
    <div>
      <Form.Field {form} name="id" class="hidden">
        <Form.Control>
          {#snippet children({ props })}
            <!-- prettier-ignore -->
            <Input {...props} bind:value={($formData as FormDataPasskey).id} type="hidden" />
          {/snippet}
        </Form.Control>
      </Form.Field>
      <Form.Field {form} name="attestationObjectBase64" class="hidden">
        <Form.Control>
          {#snippet children({ props })}
            <!-- prettier-ignore -->
            <Input {...props} bind:value={($formData as FormDataPasskey).attestationObjectBase64} type="hidden" />
          {/snippet}
        </Form.Control>
      </Form.Field>
      <Form.Field {form} name="clientDataJSONBase64" class="hidden">
        <Form.Control>
          {#snippet children({ props })}
            <!-- prettier-ignore -->
            <Input {...props} bind:value={($formData as FormDataPasskey).clientDataJSONBase64} type="hidden" />
          {/snippet}
        </Form.Control>
      </Form.Field>
      <Label class="mb-2">{m["form.passkey"]()}</Label>
      <Passkey.State state={$passkeyLoading} onclick={onSetPasskey} />
      <Text style="md" color="medium">
        {m["login.or"]()}
        <Button variant="link" size="sm" onclick={onToggle} class="text-inherit">
          {m["login.usePassphrase"]()}
        </Button>.
      </Text>
    </div>
  {/if}
</Form.Root>
