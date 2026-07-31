<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { m } from "$i18n/messages.js";
  import { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Passkey } from "$lib/components/ui/passkey";
  import type { PasskeyState } from "$lib/components/ui/passkey/state.svelte";
  import logger from "$lib/logger";
  import { auth } from "$lib/stores/auth";
  import { getPasskeyFormData } from "$lib/utils/passkey";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { writable, type Writable } from "svelte/store";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { superForm } from "sveltekit-superforms/client";
  import { formSchema } from "./schema";

  let account = $derived($auth.user);
  let tenantId: string | undefined = $state();
  let passkeyId: string | undefined = $state();
  let prfOutput: ArrayBuffer | undefined = $state();
  let kyberKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array } | undefined = $state();
  let isSubmitting = $state(false);

  const form = superForm(
    {
      deviceName: "",
      email: untrack(() => account?.email || ""),
      userId: untrack(() => account?.id || ""),
      id: "",
      attestationObjectBase64: "",
      clientDataJSONBase64: "",
      challenge: "",
    },
    {
      validators: zodClient(formSchema),
      onChange: (event) => {
        if (event.paths.includes("email")) {
          setProperPasskeyState();
        }
      },
    },
  );

  const { form: formData, enhance } = form;
  const passkeyLoading: Writable<PasskeyState> = writable("click");

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
      isAdditionalPasskey: true,
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

  const storeStaffKeyPairForNewPasskey = async () => {
    if (tenantId && passkeyId && prfOutput && kyberKeyPair) {
      const crypto = new UnifiedAppointmentCrypto();
      return await crypto
        .storeStaffKeyPairForNewPasskey(
          tenantId,
          $formData.userId,
          passkeyId,
          prfOutput,
          kyberKeyPair,
        )
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

  const onSubmit = async () => {
    isSubmitting = false;
    try {
      const resp = await fetch(`/api/auth/passkeys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passkey: {
            id: $formData.id,
            attestationObject: $formData.attestationObjectBase64,
            clientDataJSON: $formData.clientDataJSONBase64,
            deviceName: $formData.deviceName,
          },
        }),
      });
      if (resp.status >= 400) {
        throw Error(`Adding passkey failed. Error: ${await resp.text()}`);
      }

      const respBody = await resp.json();
      console.log("respBody", respBody);

      await storeStaffKeyPairForNewPasskey();

      // TODO: Add later with respBody
      //   const crypto = $staffCrypto.crypto;
      //   if (crypto) {
      //     crypto.rewrapAllTunnelsForNewPasskey();
      //   } else {
      //     throw Error(`Adding passkey failed. Error: staffCrypto is undefined`);
      //   }
      toast.success(m["setupPasskey.success"]());
      invalidate("app:account-passkeys");
    } catch (error) {
      console.error("Unable to add passkey", error);
      toast.error(m["setupPasskey.error"]());
    } finally {
      isSubmitting = false;
    }
  };
</script>

<Form.Root {enhance}>
  <Form.Field {form} name="deviceName">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.deviceName"]()}</Form.Label>
        <Input {...props} bind:value={$formData.deviceName} type="text" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>
      {m["form.deviceNameHint"]()}
    </Form.Description>
  </Form.Field>
  <div>
    <Form.Field {form} name="email">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.email} type="email" />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="userId" class="">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.userId} type="text" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Field {form} name="id" class="">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.id} type="text" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Field {form} name="attestationObjectBase64" class="">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.attestationObjectBase64} type="text" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Field {form} name="clientDataJSONBase64" class="">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.clientDataJSONBase64} type="text" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Form.Field {form} name="challenge" class="">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} bind:value={$formData.challenge} type="text" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <Label class="mb-2">{m["form.passkey"]()}</Label>
    <Passkey.State state={$passkeyLoading} onclick={onSetPasskey} />
  </div>
  <Form.Button
    type="button"
    size="lg"
    class="w-full"
    onclick={onSubmit}
    isLoading={isSubmitting}
    disabled={isSubmitting}
  >
    {m["setupPasskey.action"]()}
  </Form.Button>
</Form.Root>
