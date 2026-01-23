<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { InlineCode } from "$lib/components/ui/inline-code";
  import { Input } from "$lib/components/ui/input";
  import { TranslationWithComponent } from "$lib/components/ui/translation-with-component";
  import { Text } from "$lib/components/ui/typography";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { z } from "zod";
  import { formSchema } from ".";
  import type { TStaff } from "$lib/types/users";

  let { entity, done }: { entity: TStaff; done: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = superForm(
    { id: entity.id, email: "", confirmationState: entity.confirmationState },
    {
      validators: zodClient(
        formSchema.merge(
          z.object({
            email: z.string().refine((val) => val === entity.email, {
              message: m["form.errors.deleteConfirmation"]({
                expectedValue: entity.email,
              }),
            }),
          }),
        ),
      ),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["staff.delete.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["staff.delete.error"]());
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
      translation={m["staff.delete.description"]({ email: "{email}" })}
      interpolations={[{ param: "{email}", value: entity.email, snippet: inlineCode }]}
    />
  </Text>
  <Form.Field {form} name="email">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.email"]()}</Form.Label>
        <Input {...props} bind:value={$formData.email} type="text" autocomplete="off" />
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
  <Form.Field {form} name="confirmationState" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.confirmationState} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>

  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["staff.delete.action"]()}
    </Form.Button>
  </div>
</Form.Root>

{#snippet inlineCode(value: string | number)}
  <InlineCode>{value}</InlineCode>
{/snippet}
