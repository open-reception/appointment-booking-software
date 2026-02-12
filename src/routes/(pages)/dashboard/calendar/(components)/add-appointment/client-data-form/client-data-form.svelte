<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import type { TAddAppointment } from "../types";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";

  let {
    newAppointment,
    proceed,
  }: {
    newAppointment: TAddAppointment;
    proceed: (data: TAddAppointment) => void;
  } = $props();

  const form = superForm(
    // eslint-disable-next-line no-constant-condition
    { name: "", phone: true ? "" : undefined, shareEmail: false },
    {
      validators: zodClient(formSchema),
      onSubmit: async ({ cancel }) => {
        if ($formData.phone === "") {
          $formData.phone = undefined;
        }

        const validation = await validateForm();
        if (validation.valid) {
          cancel();
          proceed({
            ...newAppointment,
            name: $formData.name,
            phone: $formData.phone,
            shareEmail: $formData.shareEmail,
          });
        }
      },
    },
  );

  const { form: formData, enhance, validateForm } = form;
</script>

<Form.Root {enhance} class="w-full">
  <Form.Field {form} name="name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.name"]()}</Form.Label>
        <Input {...props} bind:value={$formData.name} type="name" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="phone">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.phone"]()}</Form.Label>
        <Input {...props} bind:value={$formData.phone} type="phone" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description class="mt-1">
      {m["calendar.addAppointment.steps.clientData.phoneHint"]()}
    </Form.Description>
  </Form.Field>
  {#if newAppointment.email}
    <Form.Field {form} name="shareEmail">
      <Form.Control>
        {#snippet children({ props })}
          <CheckboxWithLabel
            {...props}
            bind:value={$formData.shareEmail}
            label={m["calendar.addAppointment.steps.clientData.shareEmail"]()}
            onCheckedChange={(v) => {
              $formData.shareEmail = v;
            }}
          />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  {/if}
  <div class="mt-0 flex flex-col gap-4">
    <Form.Button size="lg" type="submit">
      {m["calendar.addAppointment.steps.clientData.action"]()}
    </Form.Button>
  </div>
</Form.Root>
