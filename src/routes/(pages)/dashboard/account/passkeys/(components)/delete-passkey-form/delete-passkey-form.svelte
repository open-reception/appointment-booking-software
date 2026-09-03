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

  let { id, deviceName, done }: { id: string; deviceName: string; done: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const form = superForm(
    { passkeyId: id, deviceName: "" },
    {
      validators: zodClient(
        formSchema.merge(
          z.object({
            deviceName: z.string().refine((val) => val === deviceName, {
              message: m["form.errors.deleteConfirmation"]({
                expectedValue: deviceName,
              }),
            }),
          }),
        ),
      ),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["account.passkeys.delete.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["account.passkeys.delete.error"]());
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
      translation={m["account.passkeys.delete.description"]({ name: "{name}" })}
      interpolations={[{ param: "{name}", value: deviceName, snippet: inlineCode }]}
    />
  </Text>
  <Form.Field {form} name="deviceName">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["form.deviceName"]()}</Form.Label>
        <Input {...props} bind:value={$formData.deviceName} type="text" autocomplete="off" />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="passkeyId" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.passkeyId} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>

  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["account.passkeys.delete.action"]()}
    </Form.Button>
  </div>
</Form.Root>

{#snippet inlineCode(value: string | number)}
  <InlineCode>{value}</InlineCode>
{/snippet}
