<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import Calendar from "$lib/components/ui/calendar/calendar.svelte";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { toInputDateTime } from "$lib/utils/datetime";
  import type { DateValue } from "@internationalized/date";
  import { getLocalTimeZone } from "@internationalized/date";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import type { ChangeEventHandler, HTMLInputAttributes } from "svelte/elements";

  type Props = Omit<HTMLInputAttributes, "type" | "files"> & {
    id: string;
    type: "date" | "datetime-local";
    value?: string;
  };

  let { id, type, value = $bindable(), ...restProps }: Props = $props();

  let open = $state(false);
  let derivedValue = $derived(toInputDateTime(value));

  const updateValue = (newValue: DateValue) => {
    value = newValue.toDate(getLocalTimeZone()).toISOString();
  };

  const onChangeDate = (dateValue: DateValue | undefined) => {
    open = false;
    if (dateValue) {
      updateValue(
        derivedValue.copy().set({
          day: dateValue.day,
          month: dateValue.month,
          year: dateValue.year,
        }),
      );
    }
  };

  const onChangeTime: ChangeEventHandler<HTMLInputElement> = (e) => {
    const target = e.target as HTMLInputElement;
    if (target && target?.value) {
      const [hours, minutes] = target.value.split(":").map(Number);
      if (value) {
        updateValue(
          derivedValue.copy().set({
            hour: hours,
            minute: minutes,
            second: 0,
            millisecond: 0,
          }),
        );
      }
    }
  };

  $effect(() => {
    if (type === "date" && derivedValue.hour !== 0) {
      updateValue(derivedValue.copy().set({ hour: 0, minute: 0, second: 0, millisecond: 0 }));
    }
  });
</script>

<div class="flex w-full gap-3">
  <Popover.Root bind:open>
    <Popover.Trigger {id}>
      {#snippet child({ props })}
        <Button {...props} variant="outline" class="flex-2 justify-between font-normal">
          {derivedValue
            ? derivedValue.toDate(getLocalTimeZone()).toLocaleDateString()
            : "Select date"}
          <ChevronDownIcon />
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-auto overflow-hidden p-0" align="start">
      <Calendar
        type="single"
        bind:value={derivedValue}
        onValueChange={onChangeDate}
        captionLayout="dropdown"
      />
    </Popover.Content>
  </Popover.Root>
  {#if type === "datetime-local"}
    <div class="flex-1">
      <Input
        type="time"
        step="60"
        value={derivedValue
          ? `${derivedValue.hour.toString().padStart(2, "0")}:${derivedValue.minute.toString().padStart(2, "0")}`
          : ""}
        onchange={onChangeTime}
        class="bg-background w-full appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
    </div>
  {/if}
</div>
<input {...restProps} type="hidden" value={derivedValue.toDate(getLocalTimeZone()).toISOString()} />
