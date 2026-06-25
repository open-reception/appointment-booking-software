<script lang="ts">
  import { browser } from "$app/environment";
  import { m } from "$i18n/messages";
  import { getLocale } from "$i18n/runtime";
  import { Button } from "$lib/components/ui/button";
  import * as Calendar from "$lib/components/ui/calendar";
  import Day from "$lib/components/ui/calendar-custom/day.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { auth } from "$lib/stores/auth";
  import type { TAppointmentFilter } from "$lib/types/calendar";
  import {
    getLocalTimeZone,
    today,
    type CalendarDate,
    type DateValue,
  } from "@internationalized/date";
  import { createQuery } from "@tanstack/svelte-query";
  import type { DateMatcher } from "bits-ui";
  import { type ComponentProps } from "svelte";
  import type { OnChangeFn } from "vaul-svelte";
  import { calendarMonthQuery } from "./queries";

  let {
    selectedDate = $bindable(),
    shownAppointments,
    shownChannels,
    shownAgents,
    onSelectDay,
    ref = $bindable(null),
  }: ComponentProps<typeof Sidebar.Root> & {
    selectedDate: CalendarDate;
    shownAppointments: TAppointmentFilter;
    shownChannels: string[];
    shownAgents: string[];
    onSelectDay?: OnChangeFn<DateValue | undefined>;
  } = $props();

  const tenantId = $derived($auth.user?.tenantId);
  let placeholder = $state(selectedDate);
  let isFiltering = $derived(
    shownAppointments !== "all" || shownChannels.length > 0 || shownAgents.length > 0,
  );

  const query = createQuery(() => calendarMonthQuery(tenantId, placeholder));
  const month = $derived(query.data?.calendar);

  const isDateEmpty = (date: DateValue) => {
    const day = month?.filter((it) => it.date === date.toString())[0];
    if (!day) {
      return true;
    }

    const slots = Object.values(day.channels).flatMap((it) => it.availableSlots);
    const appointments = Object.values(day.channels).flatMap((it) => it.appointments);
    if (slots.length === 0 && appointments.length == 0) {
      return true;
    }

    return false;
  };

  const isDateHighlighted: DateMatcher = (date) => {
    // Return early, if not filtering is happening
    if (!isFiltering) return false;

    const day = month?.filter((it) => it.date === date.toString())[0];
    if (!day) {
      return false;
    }

    let matches = Object.keys(day.channels).map((it) => day.channels[it]);

    // Filter by appointment state
    if (shownAppointments !== "all") {
      switch (shownAppointments) {
        case "available":
          matches = matches
            .filter((it) => it.availableSlots.length > 0)
            .filter((it) => it.availableSlots.some((s) => s.from >= new Date().toISOString()));
          break;
        case "reserved":
          matches = matches.filter(
            (it) => it.appointments.length > 0 && it.appointments.some((x) => x.status === "NEW"),
          );
          break;
        case "booked":
          matches = matches.filter(
            (it) =>
              it.appointments.length > 0 && it.appointments.some((x) => x.status === "CONFIRMED"),
          );
          break;
      }
    }

    // Filter by channel
    if (shownChannels.length > 0) {
      matches = matches.filter(
        (it) =>
          shownChannels.includes(it.channel.id) &&
          (it.appointments.length > 0 || it.availableSlots.length > 0),
      );
      if (matches.length === 0) return false;
    }

    // Filter by agent
    if (shownAgents.length > 0) {
      matches = matches.filter((it) => {
        const availableAgents = [
          ...new Set([
            ...it.availableSlots.flatMap((x) => x.availableAgents.flatMap((y) => y.id)),
            ...it.appointments.map((x) => x.agentId),
          ]),
        ];
        return availableAgents.some((it) => shownAgents.includes(it));
      });
      if (matches.length === 0) return false;
    }

    if (matches.length === 0) return false;
    return true;
  };

  const setToCurrentMonth = () => {
    if (browser) {
      const todayDate = today(getLocalTimeZone());
      placeholder = todayDate;
    }
  };

  const addMonths = (months: number) => {
    if (browser) {
      const nextDate = placeholder.add({ months });
      placeholder = nextDate;
    }
  };
</script>

<div class="flex flex-col gap-2">
  <div class="flex h-5 items-center justify-between gap-x-2">
    <Button
      size="xs"
      variant="outline"
      onclick={setToCurrentMonth}
      class="h-auto rounded-md px-2 py-1"
    >
      {m["calendar.thisMonth"]()}
    </Button>
    <div class="flex items-center justify-between gap-x-1">
      <Button
        size="xs"
        variant="outline"
        onclick={() => addMonths(3)}
        class="h-auto rounded-md px-2 py-1"
      >
        {m["calendar.addThreeMonths"]()}
      </Button>
      <Button
        size="xs"
        variant="outline"
        onclick={() => addMonths(6)}
        class="h-auto rounded-md px-2 py-1"
      >
        {m["calendar.addSixMonths"]()}
      </Button>
      <Button
        size="xs"
        variant="outline"
        onclick={() => addMonths(12)}
        class="h-auto rounded-md px-2 py-1"
      >
        {m["calendar.addOneYear"]()}
      </Button>
    </div>
  </div>
  <Calendar.Calendar
    type="single"
    locale={getLocale()}
    calendarLabel={m["calendar.selectDate"]()}
    class="bg-transparent p-0 [&_td]:grow [&_td_*]:mx-auto [&_th]:grow"
    preventDeselect={true}
    bind:value={selectedDate}
    bind:placeholder
    onValueChange={onSelectDay}
  >
    {#snippet day({ day, outsideMonth })}
      <Day {day} {outsideMonth} {isDateEmpty} {isDateHighlighted} />
    {/snippet}
  </Calendar.Calendar>
</div>
