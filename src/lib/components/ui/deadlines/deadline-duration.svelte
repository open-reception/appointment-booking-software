<script lang="ts">
  import * as Form from "$lib/components/ui/form";
  import * as Select from "$lib/components/ui/select";
  import type { FsSuperForm } from "formsnap";
  import type { HTMLAttributes } from "svelte/elements";
  import { deadlineUnits } from "./utils";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";
  import { m } from "$i18n/messages";
  import Input from "../input/input.svelte";
  import type { Deadline } from "$lib/server/schema/channels";

  let {
    form,
    label,
    description,
    name,
    value = $bindable(),
  }: HTMLAttributes<HTMLDivElement> & {
    form: FsSuperForm<Record<string, unknown>>;
    label: string;
    description: string;
    name: string;
    value: Deadline | undefined;
  } = $props();

  const onUnitChange = (unit: string) => {
    const values = deadlineUnits.find((u) => u.value === unit)?.values ?? [];
    value = { ...value, unit, value: values[0] ?? 1 } as Deadline;
  };

  const onValueChange = (val: string) => {
    value = { ...value, value: parseInt(val) } as Deadline;
  };
</script>

<div class="flex flex-col gap-2">
  <CheckboxWithLabel
    value={Boolean(value)}
    {label}
    tooltip={description}
    onCheckedChange={(v) => {
      value = v ? { type: "duration", value: 15, unit: "minutes" } : undefined;
    }}
  />

  {#if value}
    <Form.Field {form} name={`deadlines.${name}.type`} class="hidden">
      <Form.Control>
        {#snippet children({ props })}
          <Input {...props} value="duration" type="hidden" />
        {/snippet}
      </Form.Control>
    </Form.Field>
    <div class="flex gap-2 ml-6">
      <Form.Field {form} name={`deadlines.${name}.value`} class="w-full">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["components.deadlines.value"]()}</Form.Label>
            <Select.Root type="single" {onValueChange} name={props.name} value={`${value?.value}`}>
              <Select.Trigger {...props} class="w-full">
                {value?.value || m["unknown"]()}
              </Select.Trigger>
              <Select.Content>
                {@const values =
                  deadlineUnits.find((unit) => unit.value === value?.unit)?.values ?? []}
                {#each values as val (val)}
                  <Select.Item value={val.toString()}>{val}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
      <Form.Field {form} name={`deadlines.${name}.unit`} class="w-full">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>{m["components.deadlines.unit"]()}</Form.Label>
            <Select.Root
              type="single"
              onValueChange={onUnitChange}
              name={props.name}
              value={value?.unit}
            >
              <Select.Trigger {...props} class="w-full">
                {deadlineUnits.find((unit) => unit.value === value?.unit)?.label ?? m["unknown"]()}
              </Select.Trigger>
              <Select.Content>
                {#each deadlineUnits as unit (unit.value)}
                  <Select.Item value={unit.value}>{unit.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
      </Form.Field>
    </div>
  {/if}
</div>
