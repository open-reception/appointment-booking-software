<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import type { TAddAppointment } from "../types";
  import Button from "$lib/components/ui/button/button.svelte";
  import { hashEmail } from "$lib/client/appointment-crypto";
  import { fetchClientTunnels } from "../../../../staff/(components)/utils";
  import { toast } from "svelte-sonner";

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

          // Find client tunnel, if it exists
          const tunnels = await fetchClientTunnels(tenantId);
          const hashedEmail = await hashEmail($formData.email);
          const tunnel = tunnels.find((t) => t.emailHash === hashedEmail);

          if (tunnel) {
            toast.success(m["calendar.addAppointment.steps.selectClient.proceedExistingClient"]());
            proceed({ ...newAppointment, email: $formData.email, hasNoEmail: false, tunnel });
          } else {
            const isOk = confirm(
              m["calendar.addAppointment.steps.selectClient.confirmNewClient"](),
            );
            if (isOk) {
              proceed({ ...newAppointment, email: $formData.email, hasNoEmail: false, tunnel });
            }
          }
          isSubmitting = false;
        }
      },
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance, validateForm } = form;

  const proceedWithoutEmail = () => {
    proceed({ ...newAppointment, email: undefined, hasNoEmail: true });
  };
</script>

<Form.Root {enhance} class="w-full">
  <Form.Field {form} name="email">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.email"]()}</Form.Label>
        <Input
          {...props}
          bind:value={$formData.email}
          type="email"
          autocomplete="off"
          autocapitalize="off"
        />
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
