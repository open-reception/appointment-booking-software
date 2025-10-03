<script lang="ts">
  import { m } from "$i18n/messages";
  import { Card } from "$lib/components/ui/card";
  import * as Form from "$lib/components/ui/form";
  import * as Select from "$lib/components/ui/select";
  import type { TNewSlotTemplate, TSlotTemplate } from "$lib/types/channel";
  import { cn } from "$lib/utils";
  import { Trash } from "@lucide/svelte/icons";
  import type { FsSuperForm } from "formsnap";
  import type { HTMLAttributes } from "svelte/elements";
  import { Button } from "../button";
  import { Input } from "../input";
  import { Text } from "../typography";
  import { durations, times, weekdays } from "./utils";

  let {
    form,
    index,
    class: className,
    value = $bindable(),
    onRemove,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & {
    form: FsSuperForm<any>;
    index: number;
    value: (TSlotTemplate | TNewSlotTemplate) & { id?: string }; // Fixes type issue
    onRemove: (index: number) => void;
  } = $props();

  const onWeekdaysChange = (values: string[]) => {
    const newValue = values.map((v) => parseInt(v)).reduce((sum, x) => sum + x, 0);
    value = { ...value, weekdays: newValue };
  };

  const toSelectedWeekdays = (bitmap: number | undefined) => {
    if (!bitmap) return [];
    return weekdays.filter(({ bit }) => (bitmap & bit) === bit).map(({ bit }) => `${bit}`);
  };

  const toWeekdaysLabel = (bitmap: number | undefined) => {
    if (!bitmap) return m["components.slotTemplate.empty_weekdays"]();

    switch (bitmap) {
      case 0:
        return m["components.slotTemplate.empty_weekdays"]();
      case 127:
        return `${weekdays[0].short}-${weekdays[6].short}`;
      case 63:
        return `${weekdays[0].short}-${weekdays[5].short}`;
      case 31:
        return `${weekdays[0].short}-${weekdays[4].short}`;
      case 15:
        return `${weekdays[0].short}-${weekdays[3].short}`;
      case 7:
        return `${weekdays[0].short}-${weekdays[2].short}`;
      case 3:
        return `${weekdays[0].short}-${weekdays[1].short}`;
      default:
        return weekdays
          .filter(({ bit }) => (bitmap & bit) === bit)
          .map(({ short }) => `${short}`)
          .join(", ");
    }
  };

  const getSelectedDuration = () => {
    return (
      durations[value.duration as keyof typeof durations]?.label ||
      m["components.slotTemplate.empty_duration"]()
    );
  };

  const getSelectedTime = (key: keyof typeof times) => {
    return times[key]?.label || "";
  };
</script>

<Card class={cn("gap-2 overflow-hidden p-3", className)} {...restProps}>
  <div class="bg-muted -mx-3 -mt-3 mb-1 flex items-center justify-between px-3 py-2">
    <Text style="sm">
      {m["components.slotTemplate.template"]({ no: index + 1 })}
    </Text>
    <Button variant="ghost" size="icon" class="m-0 p-0" onclick={() => onRemove(index)}>
      <Trash />
      <span class="sr-only">
        {m["components.slotTemplate.remove"]({ no: index + 1 })}
      </span>
    </Button>
  </div>
  <Form.Field {form} name="slotTemplates[{index}]id" class="hidden">
    <Form.Control>
      {#snippet children({ props })}
        <Input {...props} value={value.id} type="hidden" />
      {/snippet}
    </Form.Control>
  </Form.Field>
  <Form.Field {form} name="slotTemplates[{index}]weekdays">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["components.slotTemplate.weekdays"]()}</Form.Label>
        <Select.Root
          type="multiple"
          onValueChange={onWeekdaysChange}
          name={props.name}
          value={toSelectedWeekdays(value.weekdays)}
        >
          <Select.Trigger {...props} class="w-full">
            {toWeekdaysLabel(value.weekdays)}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={weekdays[0].bit.toString()}>{weekdays[0].day}</Select.Item>
            <Select.Item value={weekdays[1].bit.toString()}>{weekdays[1].day}</Select.Item>
            <Select.Item value={weekdays[2].bit.toString()}>{weekdays[2].day}</Select.Item>
            <Select.Item value={weekdays[3].bit.toString()}>{weekdays[3].day}</Select.Item>
            <Select.Item value={weekdays[4].bit.toString()}>{weekdays[4].day}</Select.Item>
            <Select.Item value={weekdays[5].bit.toString()}>{weekdays[5].day}</Select.Item>
            <Select.Item value={weekdays[6].bit.toString()}>{weekdays[6].day}</Select.Item>
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
  <div class="flex gap-2">
    <Form.Field {form} name="slotTemplates[{index}]from" class="flex-1">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["components.slotTemplate.from"]()}</Form.Label>
          <Select.Root
            type="single"
            name={props.name}
            value={value.from}
            onValueChange={(v) => (value = { ...value, from: v })}
          >
            <Select.Trigger {...props} class="w-full">
              {getSelectedTime(value.from as keyof typeof times)}
            </Select.Trigger>
            <Select.Content>
              {#each Object.entries(times) as [time, value] (time)}
                <Select.Item value={time}>{value.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="slotTemplates[{index}]to" class="flex-1">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>{m["components.slotTemplate.to"]()}</Form.Label>
          <Select.Root
            type="single"
            name={props.name}
            value={value.to}
            onValueChange={(v) => (value = { ...value, to: v })}
          >
            <Select.Trigger {...props} class="w-full">
              {getSelectedTime(value.to as keyof typeof times)}
            </Select.Trigger>
            <Select.Content>
              {#each Object.entries(times) as [time, value] (time)}
                <Select.Item value={time}>{value.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors />
    </Form.Field>
  </div>
  <Form.Field {form} name="slotTemplates[{index}]duration">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{m["components.slotTemplate.duration"]()}</Form.Label>
        <Select.Root
          type="single"
          name={props.name}
          value={value.duration.toString()}
          onValueChange={(v) => (value = { ...value, duration: parseInt(v) })}
        >
          <Select.Trigger {...props} class="w-full">
            {getSelectedDuration()}
          </Select.Trigger>
          <Select.Content>
            {#each Object.entries(durations) as [duration, value] (duration)}
              <Select.Item value={duration}>{value.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
  </Form.Field>
</Card>
