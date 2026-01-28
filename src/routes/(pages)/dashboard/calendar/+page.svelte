<script lang="ts">
  import { replaceState } from "$app/navigation";
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { Button } from "$lib/components/ui/button";
  import { ResponsiveDialog } from "$lib/components/ui/responsive-dialog";
  import { ROUTES } from "$lib/const/routes";
  import { agents as agentsStore } from "$lib/stores/agents";
  import { auth } from "$lib/stores/auth";
  import { calendarStore } from "$lib/stores/calendar";
  import { channels as channelsStore } from "$lib/stores/channels";
  import { sidebar } from "$lib/stores/sidebar";
  import type { TAppointmentFilter, TCalendar, TCalendarItem } from "$lib/types/calendar";
  import { getCurrentTranlslation } from "$lib/utils/localizations";
  import {
    DateFormatter,
    getLocalTimeZone,
    parseAbsoluteToLocal,
    toCalendarDate,
    today,
    type CalendarDate,
  } from "@internationalized/date";
  import { Funnel } from "@lucide/svelte";
  import { onMount } from "svelte";
  import AppointmentDetail from "./(components)/AppointmentDetail.svelte";
  import CalendarDay from "./(components)/CalendarDay.svelte";
  import CalendarFilters from "./(components)/CalendarFilters.svelte";
  import CalendarHeader from "./(components)/CalendarHeader.svelte";
  import { fetchCalendar, openAppointmentById } from "./(components)/utils";
  import { page } from "$app/state";

  const convertDate = (dateStr: string) => {
    const zonedDateTime = parseAbsoluteToLocal(dateStr);
    return toCalendarDate(zonedDateTime);
  };

  const tenantId = $derived($auth.user?.tenantId);
  const curItem = $derived($calendarStore.curItem);
  const channels = $derived($channelsStore.channels);
  const agents = $derived($agentsStore.agents);
  let startDate: CalendarDate = $state(
    history.state["sveltekit:states"]?.date
      ? convertDate(history.state["sveltekit:states"].date)
      : today(getLocalTimeZone()),
  );
  let calender: TCalendar | undefined = $state();
  let shownAppointments: TAppointmentFilter = $state("all");
  let shownChannels: string[] = $state([]);
  let shownAgents: string[] = $state([]);
  let hours = $derived.by(() => {
    const from = channels
      .map((c) => c.slotTemplates.map((t) => t.from))
      .flat()
      .map((time) => {
        const [hourStr] = time.split(":");
        return parseInt(hourStr, 10);
      });
    const to = channels
      .map((c) => c.slotTemplates.map((t) => t.to))
      .flat()
      .map((time) => {
        const [hourStr] = time.split(":");
        return parseInt(hourStr, 10);
      });
    return { from: Math.min(...from), to: Math.max(...to) };
  });
  let scale = $state(1);

  $effect(() => {
    updateCalendar();
  });

  $effect(() => {
    if (items && history.state["sveltekit:states"]?.appointmentId) {
      // Wait 100ms to ensure that the calendar items are rendered
      setTimeout(() => {
        openAppointmentById(items, history.state["sveltekit:states"].appointmentId, () => {
          replaceState("", {});
        });
      }, 100);
    }
  });

  onMount(() => {
    if (history.state["sveltekit:states"]?.date) {
      const { date, ...rest } = history.state["sveltekit:states"];
      replaceState("", rest);
    }
  });

  // Navigating to appointment, if calendar is already mounted
  $effect(() => {
    if (
      "isNavigatingOnCalendarPage" in page.state &&
      "date" in page.state &&
      "appointmentId" in page.state
    ) {
      const date = convertDate(page.state.date as string);
      if (date.toString() !== startDate.toString()) {
        startDate = date;
        replaceState("", { appointmentId: page.state.appointmentId });
      } else {
        if (items) {
          openAppointmentById(items, history.state["sveltekit:states"].appointmentId, () => {
            replaceState("", {});
          });
        }
      }
    }
  });

  const updateCalendar = async () => {
    if (tenantId) {
      calender = undefined;
      calender = await fetchCalendar({ startDate, tenant: tenantId });
    }
  };

  const closeAppointmentDetail = () => {
    $calendarStore.curItem = null;
  };

  let items: TCalendarItem[] | undefined = $derived.by(() => {
    if (!calender) return undefined;
    const dayEntry = calender.calendar.find((d) => d.date === startDate.toString());
    if (!dayEntry) return [];
    return Object.keys(dayEntry.channels).reduce<TCalendarItem[]>((allItems, channelId) => {
      const channelData = dayEntry.channels[channelId];
      const channelItems: TCalendarItem[] = [];

      // Available slots
      if (["all", "available"].includes(shownAppointments)) {
        if (shownChannels.length === 0 || shownChannels.includes(channelId)) {
          channelData.availableSlots.forEach((slot) => {
            if (
              shownAgents.length === 0 ||
              shownAgents.some((id) => slot.availableAgents.map((a) => a.id).includes(id))
            ) {
              channelItems.push({
                id: `${channelId}-${slot.from}`,
                date: dayEntry.date,
                start: slot.from,
                duration: slot.duration,
                channelId,
                color: channelData.channel.color,
                column: 0,
                status: "available",
              });
            }
          });
        }
      }

      // Appointments
      if (["all", "booked", "reserved"].includes(shownAppointments)) {
        const formatter = new DateFormatter(navigator.language, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        channelData.appointments.forEach((appointment) => {
          const status = appointment.status === "CONFIRMED" ? "booked" : "reserved";
          if (shownAppointments === "all" || shownAppointments === status) {
            if (shownChannels.length === 0 || shownChannels.includes(channelId)) {
              if (shownAgents.length === 0 || shownAgents.includes(appointment.agentId)) {
                channelItems.push({
                  id: appointment.id,
                  date: dayEntry.date,
                  // TODO: Fix incoming date type is actually string
                  start: formatter.format(new Date(appointment.appointmentDate)),
                  duration: appointment.duration,
                  channelId,
                  color: channelData.channel.color,
                  column: 0,
                  status,
                  appointment: {
                    dateTime: new Date(appointment.appointmentDate),
                    encryptedPayload: appointment.encryptedPayload,
                    tunnelId: appointment.tunnelId,
                    agentId: appointment.agentId,
                    staffKeyShare: appointment.staffKeyShare,
                    iv: appointment.iv || undefined,
                    authTag: appointment.authTag || undefined,
                  },
                });
              }
            }
          }
        });
      }

      return [...allItems, ...channelItems];
    }, []);
  });
</script>

<SidebarLayout breakcrumbs={[{ label: m["nav.calendar"](), href: ROUTES.DASHBOARD.CALENDAR }]}>
  <MaxPageWidth maxWidth="xl">
    <div class="flex flex-col gap-10">
      <CalendarHeader bind:startDate />
      <div>
        <CalendarDay
          day={startDate}
          {items}
          earliestStartHour={hours.from}
          latestEndHour={hours.to}
          bind:scale
        />
      </div>
    </div>
  </MaxPageWidth>
  {#snippet headerRight()}
    <Button
      size="sm"
      variant="ghost"
      onclick={() => sidebar.setCalendarExpanded(!$sidebar.isCalendarExpanded)}
      class="lg:hidden"
    >
      <Funnel />
    </Button>
  {/snippet}
  {#snippet sidebarRight()}
    <CalendarFilters bind:shownAppointments bind:shownChannels bind:shownAgents bind:scale />
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
    <AppointmentDetail {tenantId} item={curItem} {updateCalendar} close={closeAppointmentDetail} />
  </ResponsiveDialog>
{/if}
