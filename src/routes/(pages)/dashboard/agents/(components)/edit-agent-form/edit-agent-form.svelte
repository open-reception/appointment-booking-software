<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import type { TAgent } from "$lib/types/agent";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import { Textarea } from "$lib/components/ui/textarea";

  let { entity, done }: { entity: TAgent; done: () => void } = $props();

  const form = superForm(
    { id: entity.id, name: entity.name, description: entity.description },
    {
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["agents.edit.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["agents.edit.error"]());
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
  <Form.Field {form} name="name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.name"]()}</Form.Label>
        <Input {...props} bind:value={$formData.name} type="text" autocomplete="off" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="description">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["agents.add.fields.description.title"]()}</Form.Label>
        <Textarea {...props} bind:value={$formData.description} maxlength={200} />
      {/snippet}
    </Form.Control>
    <Form.Description>{m["agents.add.fields.description.description"]()}</Form.Description>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.name"]()}</Form.Label>
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>

  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["agents.edit.action"]()}
    </Form.Button>
  </div>
</Form.Root>
