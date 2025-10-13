<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { CenterState } from "$lib/components/templates/empty-state";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";
  import * as Form from "$lib/components/ui/form";
  import { InputDateTime } from "$lib/components/ui/input-date-time";
  import * as Select from "$lib/components/ui/select";
  import { Text } from "$lib/components/ui/typography";
  import { agents as agentsStore } from "$lib/stores/agents";
  import StopIcon from "@lucide/svelte/icons/octagon-x";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";
  import { zodClient } from "sveltekit-superforms/adapters";
  import { reasons } from "../utils";
  import { formSchema } from "./schema";
  import { getDefaultStartTime, getDefaultEndTime } from "$lib/utils/datetime";

  let { done }: { done: () => void } = $props();

  const agents = $derived($agentsStore.agents ?? []);
  const form = superForm(
    {
      agent: "",
      absenceType: "VACATION",
      startDate: getDefaultStartTime(),
      endDate: getDefaultEndTime(),
    },
    {
      dataType: "json",
      validators: zodClient(formSchema),
      onResult: async (event) => {
        if (event.result.type === "success") {
          toast.success(m["absences.add.success"]());
          done();
        } else if (event.result.type === "failure") {
          toast.error(m["absences.add.errors.unknown"]());
        }
        isSubmitting = false;
      },
      onSubmit: () => (isSubmitting = true),
    },
  );

  let isSubmitting = $state(false);
  let isAllDay = $state(false);

  const { form: formData, enhance } = form;
</script>

{#if agents.length === 0}
  <CenterState
    headline={m["absences.add.unavailable.title"]()}
    description={m["absences.add.unavailable.description"]()}
    Icon={StopIcon}
    size="sm"
  />
{:else}
  <Form.Root {enhance} action="?/add">
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
      <Text style="xs" class="text-muted-foreground text-center">
        {m["absences.add.hint"]()}
      </Text>
      <Form.Button size="lg" type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
        {m["absences.add.action"]()}
      </Form.Button>
    </div>
  </Form.Root>
{/if}
