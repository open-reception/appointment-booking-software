<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";
  import * as Form from "$lib/components/ui/form";
  import InputOtpCustomized from "$lib/components/ui/input-top-customized/input-otp-customized.svelte";
  import { publicStore } from "$lib/stores/public";
  import { pinThrottleStore } from "$lib/stores/pin-throttle";
  import type { TPublicAppointment } from "$lib/types/public";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchemaRegister } from "./schema";

  const { proceed }: { proceed: (a: Partial<TPublicAppointment>) => void } = $props();
  const tenant = $derived($publicStore.tenant);
  const appointment = $derived($publicStore.newAppointment);

  // Subscribe to throttle state
  let throttleState = $derived($pinThrottleStore);
  let timeCounter = $state(0);

  let isThrottled = $derived.by(() => {
    // Re-evaluate whenever timeCounter changes
    timeCounter; // Read for reactivity
    if (!appointment.data?.email || !throttleState.throttleUntil) return false;
    return throttleState.throttleUntil > Date.now();
  });

  let remainingSeconds = $derived.by(() => {
    // Re-evaluate whenever timeCounter changes
    timeCounter; // Read for reactivity
    if (!throttleState.throttleUntil) return 0;
    const remaining = throttleState.throttleUntil - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000));
  });

  // Timer to update timeCounter every second
  $effect(() => {
    if (!isThrottled) {
      return;
    }

    const interval = setInterval(() => {
      timeCounter++;
    }, 1000);

    return () => clearInterval(interval);
  });

  const form = superForm(
    {
      pin: "",
    },
    {
      dataType: "json",
      validators: zodClient(formSchemaRegister),
      onSubmit: async ({ cancel }) => {
        isSubmitting = true;
        const validation = await validateForm();
        if (validation.valid && appointment.data && tenant) {
          $publicStore.crypto = new UnifiedAppointmentCrypto();
          await $publicStore.crypto
            .loginExistingClient(appointment.data?.email, $formData.pin, tenant.id)
            .then(() => {
              toast.success(m["public.login.success"]());
              proceed({ ...appointment, isNewClient: false, step: "SUMMARY" });
              cancel();
            })
            .catch(() => {
              $formData.pin = "";
              toast.error(m["public.login.error"]());
              isSubmitting = false;
            });
        }
        isSubmitting = false;
      },
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance, validateForm } = form;
</script>

<Form.Root {enhance}>
  {#if isThrottled}
    <div
      class="bg-destructive/10 border-destructive dark:bg-destructive/20 dark:border-destructive/50 mb-4 rounded-lg border p-4"
    >
      <p class="text-destructive dark:text-destructive/90 font-semibold">
        {m["public.steps.auth.login.throttled"]()}
      </p>
      <p class="text-destructive/80 dark:text-destructive/70 mt-1 text-sm">
        {m["public.steps.auth.login.retry"]({ seconds: remainingSeconds })}
      </p>
    </div>
  {/if}

  <Form.Field {form} name="pin">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.pin"]()}</Form.Label>
        <InputOtpCustomized {...props} bind:value={$formData.pin} disabled={isThrottled} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>
      {m["form.pinHint"]()}
    </Form.Description>
  </Form.Field>
  <div class="mt-6 flex flex-col gap-4">
    <Form.Button
      size="lg"
      type="submit"
      isLoading={isSubmitting}
      disabled={isSubmitting || isThrottled}
    >
      {m["public.steps.auth.login.action"]()}
    </Form.Button>
  </div>
</Form.Root>
