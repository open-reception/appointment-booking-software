<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { staff as staffStore } from "$lib/stores/staff";
  import type { TChannelWithFullAgents } from "$lib/types/channel";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";

  let { entity, done }: { entity: TChannelWithFullAgents; done: () => void } = $props();
  const staff = $derived($staffStore.staff ?? []);

  const form = superForm(
    untrack(() => ({
      id: entity.id,
      staffIds: entity.staffIds,
    })),
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        auth.refreshLastActive();
        if (event.result.type === "success") {
          toast.success(m["channels.edit.success"]());
          done();
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
  <Form.Field {form} name="staffIds">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["channels.edit.notifications.title"]()}</Form.Label>
        <Select.Root
          type="multiple"
          bind:value={$formData.staffIds}
          name={props.name}
          onValueChange={(v) => ($formData.staffIds = v)}
        >
          <Select.Trigger {...props} class="w-full">
            {$formData.staffIds.length > 0
              ? $formData.staffIds.map((id) => staff.find((x) => x.id === id)?.name).join(", ")
              : m["channels.edit.notifications.placeholder"]()}
          </Select.Trigger>
          <Select.Content>
            {#each staff as member (member.id)}
              <Select.Item value={member.id}>{member.name}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["channels.edit.action"]()}
    </Form.Button>
  </div>
</Form.Root>
