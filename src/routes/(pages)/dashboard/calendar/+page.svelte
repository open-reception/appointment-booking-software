<script lang="ts">
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { m } from "$i18n/messages";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { Button } from "$lib/components/ui/button";
  import { ResponsiveDialog } from "$lib/components/ui/responsive-dialog";
  import { ROUTES } from "$lib/const/routes";
  import { agents as agentsStore } from "$lib/stores/agents";
  import { auth } from "$lib/stores/auth";
  import { calendarStore } from "$lib/stores/calendar";
  import { channels as channelsStore } from "$lib/stores/channels";
  import { sidebar } from "$lib/stores/sidebar";
  import type { TAppointmentFilter } from "$lib/types/calendar";
  import { timeUTCToLocalWithoutOffset } from "$lib/utils/datetime";
  import { getCurrentTranlslation } from "$lib/utils/localizations";
  import { getLocalTimeZone, today, type CalendarDate } from "@internationalized/date";
  import { SlidersHorizontal } from "@lucide/svelte";
  import { createQuery, useQueryClient } from "@tanstack/svelte-query";
  import { onMount } from "svelte";
  import AddAppointment from "./(components)/add-appointment/AddAppointment.svelte";
  import Appointment from "./(components)/Appointment.svelte";
  import CalendarDay from "./(components)/CalendarDay.svelte";
  import CalendarFilters from "./(components)/CalendarFilters.svelte";
  import CalendarHeader from "./(components)/CalendarHeader.svelte";
  import CalendarLegend from "./(components)/CalendarLegend.svelte";
  import CalendarLines from "./(components)/CalendarLines.svelte";
  import CalendarWeek from "./(components)/CalendarWeek.svelte";
  import { calendarMonthQuery } from "./(components)/queries";
  import { convertDate, openAppointmentById } from "./(components)/utils";
  import type { CalendarView } from "./types";

  const queryClient = useQueryClient();
  const tenantId = $derived($auth.user?.tenantId);
  const curEmptySlot = $derived($calendarStore.curEmptySlot);
  const curItem = $derived($calendarStore.curItem);
  const channels = $derived($channelsStore.channels);
  const agents = $derived($agentsStore.agents);
  let selectedDate: CalendarDate = $state(
    "date" in page.state
      ? convertDate(history?.state["sveltekit:states"].date)
      : today(getLocalTimeZone()),
  );
  const query = createQuery(() => calendarMonthQuery(tenantId as string, selectedDate));
  const calendar = $derived(query.data);
  let shownAppointments: TAppointmentFilter = $state("all");
  let shownChannels: string[] = $state([]);
  let shownAgents: string[] = $state([]);
  let view: CalendarView = $state(page.data.calendarView);
  let hours = $derived.by(() => {
    const from = channels
      .map((c) => c.slotTemplates.map((t) => t.from))
      .flat()
      .map((time) => {
        const [hourStr] = timeUTCToLocalWithoutOffset(time).split(":");
        return parseInt(hourStr, 10);
      });
    const to = channels
      .map((c) => c.slotTemplates.map((t) => t.to))
      .flat()
      .map((time) => {
        const [hourStr] = timeUTCToLocalWithoutOffset(time).split(":");
        return parseInt(hourStr, 10);
      });
    return { from: Math.min(...from), to: Math.max(...to) };
  });
  let scale = $state(page.data.calendarZoom);

  $effect(() => {
    if (calendar && history.state["sveltekit:states"]?.appointmentId) {
      // Wait 100ms to ensure that the calendar items are rendered
      setTimeout(() => {
        openAppointmentById(
          calendar,
          channels,
          history.state["sveltekit:states"].appointmentId,
          () => {
            replaceState("", {});
          },
        );
      }, 100);
    }
  });

  // Navigating to appointment, if calendar is already mounted
  $effect(() => {
    if (
      "isNavigatingOnCalendarPage" in page.state &&
      "date" in page.state &&
      "appointmentId" in page.state
    ) {
      shownAppointments = "all";

      // navigate to date
      const date = convertDate(page.state.date as string);
      if (date.toString() !== selectedDate.toString()) {
        selectedDate = date;
      }

      // open appointment
      if (calendar) {
        openAppointmentById(
          calendar,
          channels,
          history.state["sveltekit:states"].appointmentId,
          () => {
            replaceState("", {});
          },
        );
      }
    }
  });

  onMount(() => {
    if (history.state["sveltekit:states"]?.date) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { date, ...rest } = history.state["sveltekit:states"];
      replaceState("", rest);
    }
  });

  const updateCalendar = async () => {
    if (tenantId) {
      queryClient.invalidateQueries({
        queryKey: ["calendar"],
      });
    }
  };

  const closeAppointmentDetail = () => {
    $calendarStore.curItem = null;
  };
</script>

<svelte:head>
  <title>{m["calendar.title"]()} - OpenReception</title>
</svelte:head>

<SidebarLayout breakcrumbs={[{ label: m["nav.calendar"](), href: ROUTES.DASHBOARD.CALENDAR }]}>
  <div class="flex flex-col gap-10">
    <CalendarHeader bind:selectedDate bind:view {shownAppointments} {shownAgents} {shownChannels} />
    <div
      class="flex transition-all duration-200"
      style:min-height={`${(hours.to * 30 + 60) * scale}px`}
    >
      {#if view === "day"}
        <CalendarLegend
          day={selectedDate}
          isLoading={calendar === undefined}
          earliestStartHour={hours.from}
          latestEndHour={hours.to}
          bind:scale
        />
        <CalendarDay
          day={selectedDate}
          {selectedDate}
          {calendar}
          {shownAppointments}
          {shownAgents}
          {shownChannels}
          earliestStartHour={hours.from}
          latestEndHour={hours.to}
          bind:scale
        />
        <CalendarLines
          day={selectedDate}
          earliestStartHour={hours.from}
          latestEndHour={hours.to}
          isLoading={calendar === undefined}
          bind:scale
        />
      {:else}
        <CalendarWeek
          day={selectedDate}
          {selectedDate}
          {calendar}
          {shownAppointments}
          {shownAgents}
          {shownChannels}
          {view}
          earliestStartHour={hours.from}
          latestEndHour={hours.to}
          bind:scale
        />
      {/if}
    </div>
  </div>
  {#snippet headerRight()}
    <Button
      size="sm"
      variant="ghost"
      onclick={() => sidebar.setCalendarExpanded(!$sidebar.isCalendarExpanded)}
      class="lg:hidden"
    >
      <SlidersHorizontal />
    </Button>
  {/snippet}
  {#snippet sidebarRight()}
    <CalendarFilters
      bind:shownAppointments
      bind:shownChannels
      bind:shownAgents
      bind:scale
      bind:view
      bind:selectedDate
    />
  {/snippet}
</SidebarLayout>

{#if curItem && tenantId}
  {@const channel = channels.find((c) => c.id === curItem.appointment.channelId)}
  {@const agent = agents.find((a) => a.id === curItem.appointment.appointment?.agentId)}
  <ResponsiveDialog
    id="current-calendar-item"
    title={agent?.name || "unkown agent"}
    description={channel ? getCurrentTranlslation(channel.names) : undefined}
    triggerHidden={true}
  >
    <Appointment {tenantId} item={curItem} {updateCalendar} close={closeAppointmentDetail} />
  </ResponsiveDialog>
{/if}

{#if curEmptySlot && tenantId}
  {@const channel = channels.find((c) => c.id === curEmptySlot.channelId)}
  <ResponsiveDialog
    id="current-calendar-slot"
    title={m["calendar.addAppointment.title"]()}
    description={channel ? getCurrentTranlslation(channel.names) : undefined}
    triggerHidden={true}
  >
    <AddAppointment {tenantId} item={curEmptySlot} {updateCalendar} />
  </ResponsiveDialog>
{/if}
