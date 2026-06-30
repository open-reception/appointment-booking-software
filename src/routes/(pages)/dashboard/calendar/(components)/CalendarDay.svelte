<script lang="ts">
  import { type TAppointmentFilter, type TCalendar, type TCalendarItem } from "$lib/types/calendar";
  import { cn } from "$lib/utils";
  import { getContrastColor } from "$lib/utils/color";
  import { toDisplayDateTime, utcToLocalWithoutDST } from "$lib/utils/datetime";
  import { CalendarDate, getLocalTimeZone, toCalendarDate, today } from "@internationalized/date";
  import { tv } from "tailwind-variants";
  import AppointmentPreview from "./AppointmentPreview.svelte";
  import SlotPreview from "./SlotPreview.svelte";
  import { positionItems } from "./utils";
  import { Text } from "$lib/components/ui/typography";
  import { Separator } from "$lib/components/ui/separator";

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

  const hourSize = $derived(60 * scale);
  const focusAdjustment = $derived(30 * scale);

  const slotVariants = tv({
    base: "",
    variants: {
      status: {
        available: "border-1 border-[var(--channel-color)] bg-background",
        booked: "border-none bg-[var(--channel-color)]",
        reserved:
          "bg-[var(--channel-color)]/60 hover:bg-[var(--channel-color)]/90 border-1 border-[var(--channel-color)] border-dashed",
      },
    },
  });
</script>

<div class="relative flex w-full flex-col">
  {#if isWeekView && items}
    {@const isSelected = selectedDate.toString() === items[0]?.date}
    {@const isToday = toCalendarDate(day).toString() === today(getLocalTimeZone()).toString()}
    <Text
      style="xs"
      class={cn(
        "absolute -top-5 left-1 z-20",
        isSelected && "bg-primary text-secondary rounded-sm px-1",
        isToday && "rounded-sm border-2 border-red-500/50 px-1",
      )}
    >
      {toDisplayDateTime(day.toDate(getLocalTimeZone()), { weekday: "short" })}
    </Text>
    <Separator
      orientation="vertical"
      class="bg-muted-foreground absolute top-0 bottom-0 left-0 z-10 transition-all duration-200"
      style={{ height: `${(latestEndHour * 30 + 30) * scale + 20}px`, marginTop: "-10px" }}
    />
  {/if}
  <div class="absolute top-0 right-0 bottom-0 left-0 z-10">
    {#each processedItems as item, index (`${item.id}-${index}`)}
      {@const top =
        (item.startMinutes / 60) * hourSize + focusAdjustment - earliestStartHour * hourSize}
      {@const height = item.duration * scale}
      {@const width = 100 / item.totalColumns}
      {@const left = item.column * width}
      <div
        class="absolute flex items-center rounded p-px transition-all duration-200 focus-within:z-10 focus-within:min-h-5 focus-within:scale-[1.02] focus-within:shadow-md focus-within:outline-3 hover:z-10 hover:min-h-5 hover:scale-[1.02] hover:shadow-md"
        style:top={`${top}px`}
        style:height={`${height}px`}
        style:left={`${left}%`}
        style:width={`${width}%`}
        data-id={item.id}
        style={item.color
          ? `--channel-color-contrast: ${getContrastColor(item.color)};`
          : undefined}
      >
        <div
          style="--channel-color: {item.color}"
          class={cn(
            "h-full w-full overflow-hidden rounded leading-none",
            slotVariants({ status: item.status }),
          )}
        >
          {#if ["booked", "reserved"].includes(item.status)}
            <AppointmentPreview {item} {scale} />
          {:else if item.status === "available"}
            <SlotPreview {item} />
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
