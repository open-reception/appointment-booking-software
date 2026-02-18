<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { m } from "$i18n/messages.js";
  import { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";
  import * as Form from "$lib/components/ui/form";
  import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
  import { Input } from "$lib/components/ui/input";
  import InputOtpCustomized from "$lib/components/ui/input-top-customized/input-otp-customized.svelte";
  import { ROUTES } from "$lib/const/routes";
  import { pinThrottleStore } from "$lib/stores/pin-throttle";
  import { publicStore } from "$lib/stores/public";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from "./schema";
  import { onMount } from "svelte";

  let { formId, onEvent }: { formId: string; onEvent: EventReporter } = $props();

  const form = superForm(
    {
      email: "",
      pin: "",
    },
    {
      validators: zodClient(formSchema),
      onSubmit: async ({ cancel }) => {
        onEvent({ isSubmitting: true });
        const validation = await validateForm();
        if (validation.valid && $publicStore.tenant) {
          cancel();
          $publicStore.crypto = new UnifiedAppointmentCrypto();
          await $publicStore.crypto
            .loginExistingClient($formData.email, $formData.pin, $publicStore.tenant.id)
            .then(() => {
              toast.success(m["public.login.success"]());
              goto(resolve(ROUTES.CLIENTS.MAIN));
            })
            .catch(() => {
              $formData.pin = "";
              toast.error(m["public.login.error"]());
              onEvent({ isSubmitting: false });
            });
        }
        onEvent({ isSubmitting: false });
      },
    },
  );
  const { form: formData, enhance, validateForm } = form;

  // Subscribe to throttle state
  let throttleState = $derived($pinThrottleStore);
  let timeCounter = $state(0);
  let isThrottled = $derived.by(() => {
    // Re-evaluate whenever timeCounter changes
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    timeCounter; // Read for reactivity
    if (!$formData?.email || !throttleState.throttleUntil) return false;
    return throttleState.throttleUntil > Date.now();
  });

  onMount(() => {
    if ($publicStore.crypto?.isClientAuthenticated()) {
      goto(resolve(ROUTES.CLIENTS.MAIN));
    }
  });
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
  <Form.Field {form} name="email">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label class="mb-2">{m["form.pin"]()}</Form.Label>
        <InputOtpCustomized {...props} bind:value={$formData.pin} disabled={isThrottled} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</Form.Root>
