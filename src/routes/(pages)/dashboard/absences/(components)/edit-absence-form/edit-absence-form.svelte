<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { InputDateTime } from "$lib/components/ui/input-date-time";
  import * as Select from "$lib/components/ui/select";
  import { agents as agentsStore } from "$lib/stores/agents";
  import type { TAbsence } from "$lib/types/absence";

  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { formSchema } from ".";
  import { reasons } from "../utils";
  import { toInputDateTime } from "$lib/utils/datetime";

  let { entity, done }: { entity: TAbsence; done: () => void } = $props();

  const agents = $derived($agentsStore.agents ?? []);
  const form = superForm(
    {
      id: entity.id,
      agent: entity.agentId,
      absenceType: entity.absenceType,
      startDate: entity.startDate,
      endDate: entity.endDate,
    },
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["absences.edit.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["absences.edit.error"]());
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);
  let startDate = toInputDateTime(entity.startDate);
  let endDate = toInputDateTime(entity.endDate);
  let isAllDay = $state(
    startDate.hour === 0 && startDate.minute === 0 && endDate.hour === 0 && endDate.minute === 0,
  );

  const { form: formData, enhance } = form;
</script>

<Form.Root {enhance} action="?/edit">
  <Form.Field {form} name="id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} bind:value={$formData.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>
  <Form.Field {form} name="agent">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["absences.add.fields.agent.title"]()}</Form.Label>
        <Select.Root
          type="single"
          bind:value={$formData.agent}
          name={props.name}
          onValueChange={(v) => ($formData.agent = v)}
        >
          <Select.Trigger {...props} class="w-full">
            {$formData.agent
              ? agents.find((x) => x.id === $formData.agent)?.name
              : m["absences.add.fields.agent.placeholder"]()}
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
  <Form.Field {form} name="absenceType">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["absences.add.fields.absenceType.title"]()}</Form.Label>
        <Select.Root
          type="single"
          bind:value={$formData.absenceType}
          name={props.name}
          onValueChange={(v) => ($formData.absenceType = v)}
        >
          <Select.Trigger {...props} class="w-full">
            {$formData.absenceType
              ? reasons.find((x) => x.value === $formData.absenceType)?.label
              : m["absences.add.fields.absenceType.placeholder"]()}
          </Select.Trigger>
          <Select.Content>
            {#each reasons as reason (reason.value)}
              <Select.Item value={reason.value}>{reason.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <CheckboxWithLabel
    bind:value={isAllDay}
    label={m["absences.add.fields.isAllDay.label"]()}
    onCheckedChange={(v) => {
      isAllDay = v;
    }}
    class="mt-2 mb-1"
  />
  <Form.Field {form} name="startDate">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["absences.add.fields.startDate.title"]()}</Form.Label>
        <InputDateTime
          {...props}
          type={isAllDay ? "date" : "datetime-local"}
          bind:value={$formData.startDate}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Field {form} name="endDate">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["absences.add.fields.endDate.title"]()}</Form.Label>
        <InputDateTime
          {...props}
          type={isAllDay ? "date" : "datetime-local"}
          bind:value={$formData.endDate}
        />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <div class="mt-6 flex flex-col gap-4">
    <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
      {m["absences.edit.action"]()}
    </Form.Button>
  </div>
</Form.Root>
