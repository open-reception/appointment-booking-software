<script lang="ts">
  import { Separator } from "$lib/components/ui/separator";
  import { Text } from "$lib/components/ui/typography";
  import { type TAppointmentFilter, type TCalendar, type TCalendarItem } from "$lib/types/calendar";
  import { cn } from "$lib/utils";
  import { toDisplayDateTime, utcToLocalWithoutDST } from "$lib/utils/datetime";
  import { CalendarDate, getLocalTimeZone, toCalendarDate, today } from "@internationalized/date";
  import CalendarDayItem from "./CalendarDayItem.svelte";
  import { positionItems } from "./utils";

  let {
    day = $bindable(),
    selectedDate,
    calendar,
    shownAppointments,
    shownChannels,
    shownAgents,
    earliestStartHour,
    latestEndHour,
    scale = $bindable(),
    isWeekView,
  }: {
    day: CalendarDate;
    selectedDate: CalendarDate;
    calendar: TCalendar | undefined;
    shownAppointments: TAppointmentFilter;
    shownChannels: string[];
    shownAgents: string[];
    earliestStartHour: number;
    latestEndHour: number;
    scale: number;
    isWeekView?: boolean;
  } = $props();

  let items: TCalendarItem[] | undefined = $derived.by(() => {
    if (!calendar) return undefined;
    const dayEntry = calendar.calendar.find((d) => d.date === day.toString());
    if (!dayEntry) return [];
    return Object.keys(dayEntry.channels).reduce<TCalendarItem[]>((allItems, channelId) => {
      const channelData = dayEntry.channels[channelId];
      const channelItems: TCalendarItem[] = [];

      // Available slots
      if (["all", "available"].includes(shownAppointments)) {
        if (shownChannels.length === 0 || shownChannels.includes(channelId)) {
          channelData.availableSlots.forEach((slot) => {
            const isSlotInPast = utcToLocalWithoutDST(new Date(slot.to)) < new Date();
            if (!isSlotInPast) {
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
                  availableAgents: slot.availableAgents,
                });
              }
            }
          });
        }
      }

      // Appointments
      if (["all", "booked", "reserved"].includes(shownAppointments)) {
        channelData.appointments.forEach((appointment) => {
          const status = appointment.status === "CONFIRMED" ? "booked" : "reserved";
          if (shownAppointments === "all" || shownAppointments === status) {
            if (shownChannels.length === 0 || shownChannels.includes(channelId)) {
              if (shownAgents.length === 0 || shownAgents.includes(appointment.agentId)) {
                channelItems.push({
                  id: appointment.id,
                  date: dayEntry.date,
                  start: new Date(appointment.appointmentDate).toISOString(),
                  duration: appointment.duration,
                  channelId,
                  color: channelData.channel.color,
                  column: 0,
                  status,
                  progress: appointment.progress || "UNKNOWN",
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
  // Process items to handle overlaps
  let processedItems = $derived(positionItems(items));
</script>

<div
  class="relative flex w-full flex-col"
  data-id="calendar-day"
  style:min-width={`${shownAgents.length ? shownAgents.length * 54 : 70}px`}
>
  {#if isWeekView && items}
    <!-- Date -->
    {@const isSelected = selectedDate.toString() === day.toString()}
    {@const isToday = toCalendarDate(day).toString() === today(getLocalTimeZone()).toString()}
    <Text
      style="xs"
      class={cn(
        "absolute -top-5 left-1 z-20",
        isSelected && "bg-primary text-secondary rounded-sm px-1",
        isToday && "rounded-sm border-2 border-red-500/50 px-1",
      )}
    >
      {toDisplayDateTime(day.toDate(getLocalTimeZone()), {
        day: "numeric",
        weekday: "short",
      })}
    </Text>

    <!-- Vertical line separating days in week view -->
    <Separator
      orientation="vertical"
      class="bg-muted-foreground absolute top-0 bottom-0 left-0 z-10 transition-all duration-200"
      style={{
        height: `${
          // shown hours in minutes
          ((latestEndHour - earliestStartHour) * 60 +
            // plus 30 minutes before the day starts
            30) *
            scale +
          // plus 3 pixels for the bottom overflow of the line
          4 +
          // plus 10 pixels for the margin
          10
        }px`,
        marginTop: "-10px",
      }}
    />
  {/if}
  {@render renderProcessedItems()}
</div>

{#snippet renderProcessedItems()}
  <div class="absolute top-0 right-0 bottom-0 left-0 z-10">
    {#each processedItems as item, index (`${item.id}-${index}`)}
      <CalendarDayItem {item} {scale} {earliestStartHour} />
    {/each}
  </div>
{/snippet}
