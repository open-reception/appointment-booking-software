<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import type { TAddAppointment } from "../types";
  import Button from "$lib/components/ui/button/button.svelte";

  let {
    tenantId,
    newAppointment,
    proceed,
  }: {
    tenantId: string;
    newAppointment: TAddAppointment;
    proceed: (data: TAddAppointment) => void;
  } = $props();

  const form = superForm(
    { email: "" },
    {
      validators: zodClient(formSchema),
      onSubmit: async ({ cancel }) => {
        const validation = await validateForm();
        if (validation.valid) {
          cancel();
          isSubmitting = true;
          console.log("tenantId", tenantId);
          console.log("email", $formData.email);
          const hashedEmail = await hashEmail($formData.email);
          console.log("hashed", hashedEmail);
          proceed({ ...newAppointment, email: $formData.email, hasNoEmail: false });
          // const success = await confirmAppointment({
          //   tenant: tenantId,
          //   appointment: item.appointment.id,
          //   email: item.decrypted.shareEmail ? item.decrypted.email : undefined,
          //   locale: "de", // TODO: Use client language as soon as available in appointment
          // });
          // if (success) {
          //   toast.success(m["calendar.confirmAppointment.success"]());
          //   updateCalendar();
          //   close();
          // } else {
          //   toast.error(m["calendar.confirmAppointment.error"]());
          // }

          isSubmitting = false;
        }
      },
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance, validateForm } = form;

  // TODO: Use the version from appointment-crypto
  const hashEmail = async (email: string): Promise<string> => {
    const emailNormalized = email.toLowerCase().trim();
    const encoder = new TextEncoder();
    const data = encoder.encode(emailNormalized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const proceedWithoutEmail = () => {
    proceed({ ...newAppointment, email: undefined, hasNoEmail: true });
  };
</script>

<Form.Root {enhance} class="w-full">
  <Form.Field {form} name="email">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.email"]()}</Form.Label>
        <Input {...props} bind:value={$formData.email} type="email" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>
      <Button size="sm" variant="link" onclick={proceedWithoutEmail}>
        {m["calendar.addAppointment.steps.selectClient.hasNoEmail"]()}
      </Button>
    </Form.Description>
  </Form.Field>
  <div class="mt-0 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["calendar.addAppointment.steps.selectClient.action"]()}
    </Form.Button>
  </div>
</Form.Root>
