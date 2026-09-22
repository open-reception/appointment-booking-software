<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { FormSplit } from "$lib/components/templates/form-split";
  import { Button } from "$lib/components/ui/button";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { SlotTemplate } from "$lib/components/ui/slot-template";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { channels } from "$lib/stores/channels";
  import { tenants } from "$lib/stores/tenants";
  import type { TChannelWithFullAgents, TSlotTemplate } from "$lib/types/channel";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import { DEFAULT_SLOT_TEMPLATE } from "../utils";

  let { entity }: { entity: TChannelWithFullAgents } = $props();

  const form = superForm(
    untrack(() => ({
      id: entity.id,
      slotTemplates: entity.slotTemplates,
    })),
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        auth.refreshLastActive();
        if (event.result.type === "success") {
          toast.success(m["channels.edit.success"]());
          tenants.reload();
          channels.load();
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

  const onAddSlotTemplate = () => {
    $formData.slotTemplates = [
      ...$formData.slotTemplates,
      DEFAULT_SLOT_TEMPLATE,
    ] as TSlotTemplate[];
  };

  const onRemoveSlotTemplate = (index: number) => {
    $formData.slotTemplates = $formData.slotTemplates.filter((_, i) => i !== index);
  };
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
    title={m["channels.edit.slotTemplates.title"]()}
    description={m["channels.edit.slotTemplates.description"]()}
  >
    <Form.Field {form} name="slotTemplates">
      <div class="flex flex-col gap-2 pt-2">
        <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
        {#each $formData.slotTemplates as _, i (`template-${i}`)}
          <SlotTemplate
            index={i}
            {form}
            bind:value={$formData.slotTemplates[i]}
            onRemove={onRemoveSlotTemplate}
          />
        {/each}
        <Button variant="outline" onclick={onAddSlotTemplate}>
          {m["components.slotTemplate.add_template"]()}
        </Button>
      </div>
    </Form.Field>
  </FormSplit>
  <div class="mt-6 flex flex-col items-end gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["channels.edit.action"]()}
    </Form.Button>
  </div>
</Form.Root>
