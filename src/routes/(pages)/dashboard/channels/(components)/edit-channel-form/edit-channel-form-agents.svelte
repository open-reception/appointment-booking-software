<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { ROUTES } from "$lib/const/routes";
  import { agents as agentsStore } from "$lib/stores/agents";
  import { auth } from "$lib/stores/auth";
  import type { TChannelWithFullAgents } from "$lib/types/channel";
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";

  let { entity, done }: { entity: TChannelWithFullAgents; done: () => void } = $props();
  const agents = $derived($agentsStore.agents ?? []);

  const form = superForm(
    untrack(() => ({
      id: entity.id,
      agentIds: entity.agents.map((a) => a.id) ?? [],
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
  <Form.Field {form} name="agentIds">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["channels.edit.agents.title"]()}</Form.Label>
        <Select.Root
          type="multiple"
          bind:value={$formData.agentIds}
          name={props.name}
          onValueChange={(v) => ($formData.agentIds = v)}
        >
          <Select.Trigger {...props} class="w-full">
            {$formData.agentIds.length > 0
              ? $formData.agentIds.map((id) => agents.find((x) => x.id === id)?.name).join(", ")
              : m["channels.edit.agents.placeholder"]()}
          </Select.Trigger>
          <Select.Content>
            {#each agents as agent (agent.id)}
              <Select.Item value={agent.id}>{agent.name}</Select.Item>
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
