<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import type { TChannelWithFullAgents } from "$lib/types/channel";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import { FormSplit } from "$lib/components/templates/form-split";

  let { entity }: { entity: TChannelWithFullAgents } = $props();

  const form = superForm(
    untrack(() => ({
      id: entity.id,
      isPublic: entity.isPublic || false,
      requiresConfirmation: entity.requiresConfirmation || false,
    })),
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        auth.refreshLastActive();
        if (event.result.type === "success") {
          toast.success(m["channels.edit.success"]());
        } else if (event.result.type === "failure") {
          toast.error(m["channels.edit.error"]());
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);

  const { form: formData, enhance } = form;
</script>

<Form.Root {enhance} action={`${ROUTES.DASHBOARD.CHANNELS}?/edit`}>
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>
  <FormSplit
    title="General"
    description="These settings control the overall booking experience for this channel."
  >
    <div class="flex flex-col gap-4">
      <Form.Field {form} name="isPublic">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["channels.edit.publicBooking.isPublic.title"]()}</Form.Label>
            <CheckboxWithLabel
              {...props}
              bind:value={$formData.isPublic}
              label={m["channels.edit.publicBooking.isPublic.label"]()}
              onCheckedChange={(v) => {
                $formData.isPublic = v;
              }}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name="requiresConfirmation">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["channels.edit.publicBooking.requiresConfirmation.title"]()}</Form.Label>
            <CheckboxWithLabel
              {...props}
              bind:value={$formData.requiresConfirmation}
              label={m["channels.edit.publicBooking.requiresConfirmation.label"]()}
              onCheckedChange={(v) => {
                $formData.requiresConfirmation = v;
              }}
            />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </div>
  </FormSplit>
  <div class="mt-6 flex flex-col items-end gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["channels.edit.action"]()}
    </Form.Button>
  </div>
</Form.Root>
