<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { UnifiedAppointmentCrypto } from "$lib/client/appointment-crypto";
  import * as Form from "$lib/components/ui/form";
  import InputOtpCustomized from "$lib/components/ui/input-top-customized/input-otp-customized.svelte";
  import { publicStore } from "$lib/stores/public";
  import type { TPublicAppointment } from "$lib/types/public";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchemaRegister } from "./schema";

  const { proceed }: { proceed: (a: Partial<TPublicAppointment>) => void } = $props();
  const tenant = $derived($publicStore.tenant);
  const appointment = $derived($publicStore.newAppointment);

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
          // Check if client passes precheck
          const crypto = new UnifiedAppointmentCrypto();
          const isOk = await crypto.preCheck(appointment.data?.email, tenant.id);

          if (isOk) {
            toast.error(m["public.register.error"]());
            $formData.pin = "";
            isSubmitting = false;
            cancel();
            return;
          }

          $publicStore.crypto = crypto;
          await $publicStore.crypto
            .initNewClient(appointment.data?.email, $formData.pin, tenant.id)
            .then(() => {
              proceed({ ...appointment, isNewClient: true, step: "SUMMARY" });
              cancel();
            })
            .catch(() => {
              $formData.pin = "";
              toast.error(m["public.register.error"]());
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
  <Form.Field {form} name="pin">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.pin"]()}</Form.Label>
        <InputOtpCustomized {...props} bind:value={$formData.pin} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>
      {m["form.pinHint"]()}
    </Form.Description>
  </Form.Field>
  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["public.steps.auth.register.action"]()}
    </Form.Button>
  </div>
</Form.Root>
