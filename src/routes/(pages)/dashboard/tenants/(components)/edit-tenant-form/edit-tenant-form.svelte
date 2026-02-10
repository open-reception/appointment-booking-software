<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import type { TTenant } from "$lib/types/tenant";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";

  let { entity, done }: { entity: TTenant; done: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = superForm(
    { id: entity.id, domain: entity.domain },
    {
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["tenants.edit.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["tenants.edit.error"]());
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

<Form.Root {enhance} action="?/edit">
  <Form.Field {form} name="domain">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.domain"]()}</Form.Label>
        <Input {...props} bind:value={$formData.domain} type="text" autocomplete="off" />
      {/snippet}
    </Form.Control>
    <Form.Description>
      {m["tenants.add.domain.description"]({
        domain:
          $formData.domain.length < 2 ? "" : `${$formData.domain}.${window.location.hostname}`,
      })}
    </Form.Description>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>

  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["tenants.edit.action"]()}
    </Form.Button>
  </div>
</Form.Root>
