<script lang="ts">
  import { m } from "$i18n/messages";
  import { getLocale } from "$i18n/runtime";
  import { Separator } from "$lib/components/ui/separator";
  import { Text } from "$lib/components/ui/typography";
  import { clock } from "$lib/stores/time";
  import { type TCalendarItem } from "$lib/types/calendar";
  import { cn } from "$lib/utils";
  import {
    CalendarDate,
    getLocalTimeZone,
    toCalendarDate,
    toCalendarDateTime,
    today,
  } from "@internationalized/date";
  import Loader from "@lucide/svelte/icons/loader-2";
  import { tv } from "tailwind-variants";
  import { positionItems } from "./utils";
  import AppointmentPreview from "./AppointmentPreview.svelte";

  let {
    day = $bindable(),
    items,
    earliestStartHour,
    latestEndHour,
    scale = $bindable(),
  }: {
    day: CalendarDate;
    items: TCalendarItem[] | undefined;
    earliestStartHour: number;
    latestEndHour: number;
    scale: number;
  } = $props();

  // Process items to handle overlaps
  let processedItems = $derived(positionItems(items));

  const hourSize = $derived(60 * scale);
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const shownHours = $derived(hours.slice(0, latestEndHour + 1).slice(earliestStartHour));
  const focusAdjustment = $derived(30 * scale);
  const curTimeIndicator = $derived(
    today(getLocalTimeZone()).toString() === day.toString() ? $clock : undefined,
  );

  const slotVariants = tv({
    base: "",
    variants: {
      status: {
        available: "border-1 border-[var(--channel-color)] bg-background",
        booked: "border-none bg-[var(--channel-color)]",
        reserved:
          "bg-[var(--channel-color)]/20 border-1 border-[var(--channel-color)] border-dashed",
      },
    },
  });
</script>

<div class="relative flex w-full flex-col">
  <div
    class="relative flex w-full items-start justify-between transition-all duration-200"
    style:height={`${focusAdjustment}px`}
  >
    <Separator class="bg-secondary absolute top-0 right-0 left-16 h-0.25 !w-auto" />
  </div>
  {#each shownHours as hour}
    <div
      class="relative flex w-full items-start justify-between transition-all duration-200 select-none"
      style:height={`${hourSize}px`}
    >
      <Text style="xs" class="text-muted-foreground -mt-2 w-16 shrink-0">
        {Intl.DateTimeFormat(getLocale(), {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: getLocalTimeZone().toString(),
        }).format(toCalendarDateTime(day).set({ hour }).toDate(getLocalTimeZone()))}
      </Text>
      <Separator class="bg-muted-foreground h-0.25 w-auto! grow" />
      <Separator class="bg-secondary absolute top-1/2 right-0 left-16 h-0.25 !w-auto" />
    </div>
  {/each}

  <!-- Loading state -->
  {#if items === undefined}
    <div class="absolute top-0 left-0 -mt-5">
      <Loader class="size-4 animate-spin" strokeWidth={1} />
      <span class="sr-only">{m["calendar.loading"]()}</span>
    </div>
  {/if}

  <!-- Day content area -->
  <div class="absolute top-0 right-0 bottom-0 left-16">
    {#each processedItems as item}
      {@const top =
        (item.startMinutes / 60) * hourSize + focusAdjustment - earliestStartHour * hourSize}
      {@const height = item.duration * scale}
      {@const width = 100 / item.totalColumns}
      {@const left = item.column * width}
      <div
        class="absolute flex items-center rounded p-0.25 transition-all duration-200 focus-within:z-10 focus-within:min-h-5 focus-within:scale-[1.02] focus-within:shadow-md focus-within:outline-3 hover:z-10 hover:min-h-5 hover:scale-[1.02] hover:shadow-md"
        style:top={`${top}px`}
        style:height={`${height}px`}
        style:left={`${left}%`}
        style:width={`${width}%`}
        data-id={item.id}
      >
        <div
          style="--channel-color: {item.color}"
          class={cn(
            "h-full w-full overflow-hidden rounded leading-none",
            slotVariants({ status: item.status }),
          )}
        >
          {#if ["booked", "reserved"].includes(item.status)}
            <AppointmentPreview {item} />
          {/if}
        </div>
      </div>
    {/each}
  </div>

  {#if curTimeIndicator && toCalendarDate($clock).toString() === today(getLocalTimeZone()).toString() && latestEndHour + hourSize / 2 > curTimeIndicator.hour}
    {@const top =
      focusAdjustment +
      curTimeIndicator.hour * hourSize +
      (curTimeIndicator.minute / 60) * hourSize -
      earliestStartHour * hourSize}
    <div
      class="absolute right-0 left-0 z-10 flex h-1 items-center transition-all duration-200 select-none"
      style:top={`${top}px`}
    >
      <Text style="xs" class="z-10 -ml-1 rounded-full bg-red-500 px-1 text-white">
        {Intl.DateTimeFormat(getLocale(), {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: getLocalTimeZone().toString(),
        }).format(toCalendarDateTime($clock).toDate(getLocalTimeZone()))}
      </Text>
      <div class="absolute right-0 left-0 h-0.25 bg-red-500"></div>
    </div>
  {/if}
</div>
