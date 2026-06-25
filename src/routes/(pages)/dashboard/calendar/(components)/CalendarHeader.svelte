<script lang="ts">
  import { m } from "$i18n/messages";
  import { getLocale } from "$i18n/runtime";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { cn } from "$lib/utils";
  import CalendarMonth from "./CalendarMonth.svelte";
  import type { TAppointmentFilter } from "$lib/types/calendar";
  import type { OnChangeFn } from "vaul-svelte";

  let {
    selectedDate = $bindable(),
    shownAppointments,
    shownChannels,
    shownAgents,
  }: {
    selectedDate: CalendarDate;
    shownAppointments: TAppointmentFilter;
    shownChannels: string[];
    shownAgents: string[];
  } = $props();

  let open = $state(false);

  const prev = () => {
    const nextDate = new CalendarDate(
      selectedDate.year,
      selectedDate.month,
      selectedDate.day,
    ).subtract({
      days: 1,
    });
    selectedDate = nextDate;
  };

  const next = () => {
    const nextDate = new CalendarDate(selectedDate.year, selectedDate.month, selectedDate.day).add({
      days: 1,
    });
    selectedDate = nextDate;
  };

  const setToToday = () => {
    selectedDate = today(getLocalTimeZone());
  };

  const onSelectDay: OnChangeFn<unknown> = () => {
    open = false;
  };
</script>

<div
  class="flex flex-col items-start justify-between gap-2 min-[500px]:flex-row min-[500px]:items-center"
>
  <div class="-ml-1 flex w-87.5 items-center justify-between gap-5">
    <Button size="sm" variant="ghost" class="h-6 p-1!" onclick={prev}>
      <ChevronLeft />
    </Button>
    <Popover.Root bind:open>
      <Popover.Trigger
        class={cn(buttonVariants({ variant: "ghost" }), "h-auto py-1 leading-none font-normal")}
      >
        {Intl.DateTimeFormat(getLocale(), {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short",
          timeZone: getLocalTimeZone().toString(),
        }).format(selectedDate.toDate(getLocalTimeZone()))}
      </Popover.Trigger>
      <Popover.Content class="w-64">
        <CalendarMonth
          bind:selectedDate
          {shownAppointments}
          {shownAgents}
          {shownChannels}
          {onSelectDay}
        />
      </Popover.Content>
    </Popover.Root>
    <Button size="sm" variant="ghost" class="h-6 p-1!" onclick={next}>
      <ChevronRight />
    </Button>
  </div>
  <Button
    size="sm"
    variant="outline"
    onclick={setToToday}
    disabled={selectedDate.toString() === today(getLocalTimeZone()).toString()}
    class="-order-1 ml-auto min-[500px]:order-0"
  >
    {m["calendar.today"]()}
  </Button>
</div>
