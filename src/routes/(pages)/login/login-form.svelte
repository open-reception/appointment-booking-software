<script lang="ts">
  import { goto } from "$app/navigation";
  import { m } from "$i18n/messages.js";
  import { Button } from "$lib/components/ui/button";
  import * as Form from "$lib/components/ui/form";
  import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
  import { Input } from "$lib/components/ui/input";
  import { ROUTES } from "$lib/const/routes";
  import { toast } from "svelte-sonner";
  import { writable, type Writable } from "svelte/store";
  import { type Infer, superForm, type SuperValidated } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { baseSchema, formSchema, type FormSchema } from "./schema";
  import { onMount } from "svelte";
  import { Passkey } from "$lib/components/ui/passkey";
  import { Text } from "$lib/components/ui/typography";
  import type { PasskeyState } from "$lib/components/ui/passkey/state.svelte";
  import {
    arrayBufferToBase64,
    fetchChallenge,
    getCredential,
    getPRFOutputAfterRegistration,
  } from "$lib/utils/passkey";
  import { Label } from "$lib/components/ui/label";
  import { auth } from "$lib/stores/auth";
  import logger from "$lib/logger";

  let {
    data,
    formId,
    onEvent,
  }: { formId: string; onEvent: EventReporter; data: { form: SuperValidated<Infer<FormSchema>> } } =
    $props();

  const form = superForm(data.form, {
    validators: zodClient(formSchema),
    onChange: (event) => {
      if (event.paths.includes("email")) {
        setProperPasskeyState();
      }
    },
    onResult: async (event) => {
      if (event.result.type === "success") {
        auth.setUser(event.result.data?.user);
        await goto(ROUTES.DASHBOARD.MAIN);
      } else {
        toast.error(m["login.error"]());
      }
      onEvent({ isSubmitting: false });
    },
    onSubmit: () => onEvent({ isSubmitting: true }),
  });

  onMount(() => {
    $formData.type = "passkey";
  });

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
        clientDataBase64: "",
        authenticatorDataBase64: "",
        signatureBase64: "",
      };
      setProperPasskeyState();
    }
  };

  const setProperPasskeyState = () => {
    const isOk = baseSchema.shape.email.safeParse($formData.email).success;
    if (isOk) {
      $passkeyLoading = "click";
    } else {
      $passkeyLoading = "initial";
    }
  };

  const onSetPasskey = async () => {
    $passkeyLoading = "loading";
    const challenge = await fetchChallenge($formData.email);

    if (!challenge) {
      $passkeyLoading = "error";
      logger.error("Failed to fetch challenge", { email: $formData.email });
    } else {
      $passkeyLoading = "user";

      // Call WebAuthn with PRF enabled (uses email as salt for multi-passkey support)
      const credentialResp = await getCredential({
        ...challenge,
        email: $formData.email,
        enablePRF: true, // Always enable PRF for staff authentication
      }).catch((error) => {
        $passkeyLoading = "error";
        logger.error("Failed to get credential", { ...challenge, error });
      });

      if (!credentialResp) {
        $passkeyLoading = "error";
        logger.error("Credential response is falsy");
        return;
      }

      // Update form data with passkey info
      const clientDataBase64 = arrayBufferToBase64(credentialResp.response.clientDataJSON);
      const authenticatorDataBase64 = arrayBufferToBase64(
        // @ts-expect-error response type needs to be fixed
        credentialResp.response.authenticatorData,
      );
      // @ts-expect-error response type needs to be fixed
      const signatureBase64 = arrayBufferToBase64(credentialResp.response.signature);
      $formData = {
        ...$formData,
        type: "passkey",
        id: credentialResp.id,
        authenticatorDataBase64,
        clientDataBase64,
        signatureBase64,
      };

      // Store authenticatorData and PRF output for later key reconstruction
      const passkeyId = credentialResp.id;

      // Extract PRF output from WebAuthn response (if PRF was enabled)
      let prfOutputBase64: string | undefined;
      if (credentialResp.prfOutput) {
        prfOutputBase64 = arrayBufferToBase64(credentialResp.prfOutput);
        logger.info("PRF output retrieved from login", {
          passkeyId,
          prfOutputLength: credentialResp.prfOutput.byteLength,
        });
      } else {
        logger.warn("No PRF output in login response - crypto features may not work", {
          email: $formData.email,
          passkeyId,
        });
      }

      auth.setPasskeyAuthData({
        authenticatorData: authenticatorDataBase64,
        passkeyId,
        email: $formData.email,
        prfOutput: prfOutputBase64,
      });

      // Update UI to show passkey is ready
      $passkeyLoading = "success";

      const isValid = await form.validateForm();
      if (isValid) {
        form.submit();
      }
    }
  };

  const { form: formData, enhance } = form;
  const passkeyLoading: Writable<PasskeyState> = writable("initial");

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
        {m["login.or"]()}
        <Button variant="link" size="sm" onclick={onToggle} class="text-inherit">
          {m["login.usePasskey"]()}
        </Button>
      </Form.Description>
    </Form.Field>
  {/if}
  {#if $formData.type === "passkey"}
    <div>
      <Form.Field {form} name="id" class="hidden">
        <Form.Control>
          {#snippet children({ props })}
            <!-- prettier-ignore -->
            <Input
							{...props}
							bind:value={($formData as FormDataPasskey).id}
							type="hidden"
						/>
          {/snippet}
        </Form.Control>
      </Form.Field>
      <Form.Field {form} name="authenticatorDataBase64" class="hidden">
        <Form.Control>
          {#snippet children({ props })}
            <!-- prettier-ignore -->
            <Input
							{...props}
							bind:value={($formData as FormDataPasskey).authenticatorDataBase64}
							type="hidden"
						/>
          {/snippet}
        </Form.Control>
      </Form.Field>
      <Form.Field {form} name="clientDataBase64" class="hidden">
        <Form.Control>
          {#snippet children({ props })}
            <!-- prettier-ignore -->
            <Input
							{...props}
							bind:value={($formData as FormDataPasskey).clientDataBase64}
							type="hidden"
						/>
          {/snippet}
        </Form.Control>
      </Form.Field>
      <Form.Field {form} name="signatureBase64" class="hidden">
        <Form.Control>
          {#snippet children({ props })}
            <!-- prettier-ignore -->
            <Input
							{...props}
							bind:value={($formData as FormDataPasskey).signatureBase64}
							type="hidden"
						/>
          {/snippet}
        </Form.Control>
      </Form.Field>
      <Label class="mb-2">{m["form.passkey"]()}</Label>
      <Passkey.State state={$passkeyLoading} onclick={onSetPasskey} />
      <Text style="xs" color="medium" class="mt-1 ml-1 leading-none">
        {m["login.or"]()}
        <Button variant="link" size="sm" onclick={onToggle} class="text-inherit">
          {m["login.usePassphrase"]()}
        </Button>.
      </Text>
    </div>
  {/if}
</Form.Root>
