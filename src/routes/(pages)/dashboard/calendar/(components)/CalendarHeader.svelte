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
  import type { CalendarView } from "../types";

  let {
    selectedDate = $bindable(),
    view,
    shownAppointments,
    shownChannels,
    shownAgents,
  }: {
    selectedDate: CalendarDate;
    view: CalendarView;
    shownAppointments: TAppointmentFilter;
    shownChannels: string[];
    shownAgents: string[];
  } = $props();

  let open = $state(false);
  let isWeekView = $derived(view !== "day");

  const prev = () => {
    const nextDate = new CalendarDate(
      selectedDate.year,
      selectedDate.month,
      selectedDate.day,
    ).subtract({
      days: isWeekView ? 7 : 1,
    });
    selectedDate = nextDate;
  };

  const next = () => {
    const nextDate = new CalendarDate(selectedDate.year, selectedDate.month, selectedDate.day).add({
      days: isWeekView ? 7 : 1,
    });
    selectedDate = nextDate;
  };

  const setToToday = () => {
    selectedDate = today(getLocalTimeZone());
  };

  const onSelectDay: OnChangeFn<unknown> = () => {
    open = false;
  };

  const getISOWeek = (date: CalendarDate): { week: number; year: number } => {
    // Convert to a Thursday of the same ISO week
    const dayOfWeek = date.toDate("UTC").getUTCDay() || 7; // Mon=1 ... Sun=7
    const thursday = date.add({ days: 4 - dayOfWeek });

    // The ISO year is the year of that Thursday
    const year = thursday.year;

    // Day of year for that Thursday
    const jan1 = new CalendarDate(year, 1, 1);
    const dayOfYear =
      (thursday.toDate("UTC").getTime() - jan1.toDate("UTC").getTime()) / 86_400_000 + 1;

    const week = Math.ceil(dayOfYear / 7);

    return { week, year };
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
        {#if isWeekView}
          {@const week = getISOWeek(selectedDate)}
          {m["calendar.calendarWeek"](week)}
        {:else}
          {Intl.DateTimeFormat(getLocale(), {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
            timeZone: getLocalTimeZone().toString(),
          }).format(selectedDate.toDate(getLocalTimeZone()))}
        {/if}
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
