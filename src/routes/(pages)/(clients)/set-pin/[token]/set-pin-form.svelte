<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import type { EventReporter } from "$lib/components/ui/form/form-root.svelte";
  import InputOtpCustomized from "$lib/components/ui/input-top-customized/input-otp-customized.svelte";
  import { ROUTES } from "$lib/const/routes";
  import { pinThrottleStore } from "$lib/stores/pin-throttle";
  import { publicStore } from "$lib/stores/public";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from "./schema";

  let { formId, onEvent }: { formId: string; onEvent: EventReporter } = $props();

  const form = superForm(
    {
      pin: "",
    },
    {
      validators: zodClient(formSchema),
      onSubmit: async ({ cancel }) => {
        onEvent({ isSubmitting: true });
        const validation = await validateForm();
        if (validation.valid && $publicStore.tenant) {
          if (!page.params.token) {
            console.error("Missing token in URL params");
            toast.error(m["clients.pinReset.page.error"]());
            cancel();
            return;
          }

          if (!$publicStore.crypto) {
            console.error("Crypto module is not available");
            toast.error(m["clients.pinReset.page.error"]());
            cancel();
            return;
          }

          // TODO: Get email from reset request
          const email = "";
          await $publicStore.crypto.setNewPin(
            email,
            $formData.pin,
            $publicStore.tenant?.id,
            page.params.token,
          );

          // TODO: Handle success
          toast.error(m["clients.pinReset.page.error"]());
          cancel();
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
    if (!$formData?.pin || !throttleState.throttleUntil) return false;
    return throttleState.throttleUntil > Date.now();
  });

  onMount(() => {
    if ($publicStore.crypto?.isClientAuthenticated()) {
      goto(resolve(ROUTES.CLIENTS.MAIN));
    }
  });
</script>

<Form.Root {formId} {enhance}>
  <Form.Field {form} name="pin">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label class="mb-2">{m["form.pin"]()}</Form.Label>
        <InputOtpCustomized {...props} bind:value={$formData.pin} disabled={isThrottled} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</Form.Root>
