<script lang="ts">
  import { type TAppointmentFilter, type TCalendar } from "$lib/types/calendar";
  import { getWeekDays } from "$lib/utils/datetime";
  import { CalendarDate } from "@internationalized/date";
  import CalendarDay from "./CalendarDay.svelte";
  import CalendarLegend from "./CalendarLegend.svelte";
  import CalendarLines from "./CalendarLines.svelte";
  import type { CalendarView } from "../types";

  let {
    selectedDate = $bindable(),
    day = $bindable(),
    calendar,
    shownAppointments,
    shownChannels,
    shownAgents,
    earliestStartHour,
    latestEndHour,
    view,
    scale = $bindable(),
  }: {
    selectedDate: CalendarDate;
    day: CalendarDate;
    calendar: TCalendar | undefined;
    shownAppointments: TAppointmentFilter;
    shownChannels: string[];
    shownAgents: string[];
    earliestStartHour: number;
    latestEndHour: number;
    view: CalendarView;
    scale: number;
  } = $props();

  let weekDays = $derived(getWeekDays(day, view === "week-workdays"));
</script>

<CalendarLegend
  {day}
  isLoading={calendar === undefined}
  {earliestStartHour}
  {latestEndHour}
  bind:scale
/>
{#each weekDays as weekDay (weekDay.toString())}
  <CalendarDay
    day={weekDay}
    {selectedDate}
    {calendar}
    {shownAppointments}
    {shownAgents}
    {shownChannels}
    {earliestStartHour}
    {latestEndHour}
    isWeekView={true}
    bind:scale
  />
{/each}
<CalendarLines
  {day}
  {earliestStartHour}
  {latestEndHour}
  bind:scale
  isLoading={calendar === undefined}
/>
