<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { InlineCode } from "$lib/components/ui/inline-code";
  import { Input } from "$lib/components/ui/input";
  import { TranslationWithComponent } from "$lib/components/ui/translation-with-component";
  import { Text } from "$lib/components/ui/typography";
  import type { TAgent } from "$lib/types/agent";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { z } from "zod";
  import { formSchema } from ".";

  let { entity, done }: { entity: TAgent; done: () => void } = $props();

  const form = superForm(
    { id: entity.id, name: "" },
    {
      validators: zodClient(
        formSchema.merge(
          z.object({
            name: z.string().refine((val) => val === entity.name, {
              message: m["form.errors.deleteConfirmation"]({
                expectedValue: entity.name,
              }),
            }),
          }),
        ),
      ),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["agents.delete.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["agents.delete.error"]());
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

<Form.Root {enhance} action="?/delete">
  <Text style="sm" class="text-muted-foreground -mt-2 font-normal">
    <TranslationWithComponent
      translation={m["agents.delete.description"]({ name: "{name}" })}
      interpolations={[{ param: "{name}", value: entity.name, snippet: inlineCode }]}
    />
  </Text>
  <Form.Field {form} name="name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.name"]()}</Form.Label>
        <Input {...props} bind:value={$formData.name} type="text" autocomplete="off" />
      {/snippet}
    </Form.Control>
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
      {m["agents.delete.action"]()}
    </Form.Button>
  </div>
</Form.Root>

{#snippet inlineCode(value: string | number)}
  <InlineCode>{value}</InlineCode>
{/snippet}
