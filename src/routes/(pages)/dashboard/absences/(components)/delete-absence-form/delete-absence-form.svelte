<script lang="ts">
  import { m } from "$i18n/messages.js";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { Text } from "$lib/components/ui/typography";
  import { agents as agentsStore } from "$lib/stores/agents";
  import type { TAbsence } from "$lib/types/absence";
  import { toDisplayDateTime } from "$lib/utils/datetime";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client as zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";

  const agents = $derived($agentsStore.agents ?? []);
  let { entity, done }: { entity: TAbsence; done: () => void } = $props();

  const form = superForm(
    { id: entity.id, agent: entity.agentId },
    {
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["absences.delete.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["absences.delete.error"]());
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
    {m["absences.delete.description"]({
      name:
        agents.find((a) => a.id === entity.agentId)?.name ||
        m["absences.delete.description_fallback"](),
      startDate: toDisplayDateTime(new Date(entity.startDate)),
      endDate: toDisplayDateTime(new Date(entity.endDate)),
    })}
  </Text>
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>
  <Form.Field {form} name="agent" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.agent} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>

  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["absences.delete.action"]()}
    </Form.Button>
  </div>
</Form.Root>
