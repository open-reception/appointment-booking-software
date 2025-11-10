<script lang="ts">
  import { m } from "$i18n/messages";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { Button } from "$lib/components/ui/button";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { sidebar } from "$lib/stores/sidebar";
  import type { TAppointmentFilter, TCalendar, TCalendarItem } from "$lib/types/calendar";
  import { getLocalTimeZone, now, today, type CalendarDate } from "@internationalized/date";
  import { Funnel } from "@lucide/svelte";
  import CalendarDay from "./(components)/CalendarDay.svelte";
  import CalendarFilters from "./(components)/CalendarFilters.svelte";
  import CalendarHeader from "./(components)/CalendarHeader.svelte";
  import { fetchCalendar } from "./(components)/utils";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";

  const tenantId = $derived($auth.user?.tenantId);
  let startDate: CalendarDate = $state(today(getLocalTimeZone()));
  let calender: TCalendar | undefined = $state();
  let shownAppointments: TAppointmentFilter = $state("all");
  let shownChannels: string[] = $state(["1"]);
  let shownAgents: string[] = $state(["1"]);
  let startHour = $state(0);
  let prevLatestEndHour = $state(24);
  let scale = $state(1);

  $effect(() => {
    updateCalendar();
  });

  const updateCalendar = async () => {
    if (tenantId) {
      calender = undefined;
      calender = await fetchCalendar({ startDate, tenant: tenantId });
    }
  };

  let items: TCalendarItem[] | undefined = $derived.by(() => {
    if (!calender) return undefined;
    const dayEntry = calender.calendar.find((d) => d.date === startDate.toString());
    if (!dayEntry) return [];
    return Object.keys(dayEntry.channels).reduce<TCalendarItem[]>(
      (allItems, channelId, channelIndex) => {
        const channelData = dayEntry.channels[channelId];
        const channelItems: TCalendarItem[] = [];

        // Available slots
        channelData.availableSlots.forEach((slot) => {
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
        });

        // TODO: Booked and reserved appointments

        return [...allItems, ...channelItems];
      },
      [],
    );
  });

  let earliestStartHour = $derived.by(() => {
    if (!items || items.length === 0) return 0;
    return Math.min(
      ...items.map((item) => {
        const [hour, minute] = item.start.split(":").map(Number);
        return Math.floor(hour + minute / 60);
      }),
    );
  });
  let latestEndHour = $derived.by(() => {
    if (!items || items.length === 0) return 24;
    return Math.max(
      ...items.map((item) => {
        const [hour, minute] = item.start.split(":").map(Number);
        const durationHours = item.duration / 60;
        return Math.ceil(hour + minute / 60 + durationHours);
      }),
    );
  });

  $effect(() => {
    if (items && items.length > 0 && earliestStartHour !== startHour) {
      startHour = earliestStartHour;
    }
    if (items && items.length > 0 && latestEndHour !== prevLatestEndHour) {
      prevLatestEndHour = latestEndHour;
    }
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
          earliestStartHour={startHour}
          latestEndHour={prevLatestEndHour}
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
