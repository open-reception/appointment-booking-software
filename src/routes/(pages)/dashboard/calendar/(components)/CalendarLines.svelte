<script lang="ts">
  import { getLocale } from "$i18n/runtime";
  import { Separator } from "$lib/components/ui/separator";
  import { Text } from "$lib/components/ui/typography";
  import { clock } from "$lib/stores/time";
  import { cn } from "$lib/utils";
  import {
    CalendarDate,
    getLocalTimeZone,
    toCalendarDate,
    toCalendarDateTime,
    today,
  } from "@internationalized/date";
  import { isAfterOperatingHours, isBeforeOperatingHours } from "./utils";

  let {
    day = $bindable(),
    earliestStartHour,
    latestEndHour,
    scale = $bindable(),
    isLoading,
    isCalendarScrollableRight,
  }: {
    day: CalendarDate;
    earliestStartHour: number;
    latestEndHour: number;
    scale: number;
    isLoading: boolean;
    isCalendarScrollableRight: boolean;
  } = $props();

  const hourSize = $derived(60 * scale);
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const shownHours = $derived(hours.slice(0, latestEndHour + 1).slice(earliestStartHour));
  const focusAdjustment = $derived(30 * scale);
  const curTimeIndicator = $derived(
    today(getLocalTimeZone()).toString() === day.toString() ? $clock : undefined,
  );
  const isBeforeHours = $derived(isBeforeOperatingHours(curTimeIndicator, earliestStartHour));
  const isAfterHours = $derived(isAfterOperatingHours(curTimeIndicator, latestEndHour));
</script>

{#if !isLoading}
  <div class="absolute flex w-[calc(100%-2rem)] flex-col">
    <!-- First half hour line before day starts -->
    <div
      class="relative flex w-full items-start justify-between transition-all duration-200"
      style:height={`${focusAdjustment}px`}
    >
      <Separator class="bg-secondary absolute top-0 right-0 left-16 h-px w-auto!" />
    </div>

    <!-- Current Time Indicator Line -->
    {#if !isLoading && curTimeIndicator}
      {@const isToday = toCalendarDate($clock).toString() === today(getLocalTimeZone()).toString()}
      {#if isToday && !isAfterHours && !isBeforeHours}
        {@const top =
          focusAdjustment +
          curTimeIndicator.hour * hourSize +
          (curTimeIndicator.minute / 60) * hourSize -
          earliestStartHour * hourSize}
        <div
          class={cn(
            "pointer-events-none absolute right-0 left-0 z-10 flex h-1 items-center transition-all duration-200 select-none",
            isCalendarScrollableRight ? "-mr-4" : "mr-px",
          )}
          style:top={`${top}px`}
        >
          <div class="absolute right-0 left-0 h-px bg-red-500"></div>
        </div>
      {/if}
    {/if}

    <!-- Hour lines -->
    {#each shownHours as hour (`hour-lines-${hour}`)}
      <div
        class="relative z-0 flex w-full items-start justify-between pl-1 transition-all duration-200 select-none"
        style:height={`${hourSize}px`}
      >
        <Separator
          class={cn(
            "bg-muted-foreground -z-10 -ml-0.5 h-px w-auto! grow transition-all duration-200",
            isCalendarScrollableRight ? "-mr-4" : "mr-px",
          )}
        />
        <Separator
          class={cn(
            "bg-secondary absolute top-1/2 right-0 left-16 -z-30 h-px w-auto! transition-all duration-200",
            isCalendarScrollableRight ? "-mr-4" : "mr-px",
          )}
        />
      </div>
    {/each}

    <!-- Hour markers-->
    {#each shownHours as hour (`hour-marker-${hour}`)}
      <div
        class="absolute top-0 left-0 z-20 -mt-3.5 w-16 transition-all duration-200"
        style:top={`${(hour - earliestStartHour) * hourSize + focusAdjustment}px`}
      >
        <Text style="xs" class="text-muted-foreground">
          {Intl.DateTimeFormat(getLocale(), {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: getLocalTimeZone().toString(),
          }).format(toCalendarDateTime(day).set({ hour }).toDate(getLocalTimeZone()))}
        </Text>
      </div>
    {/each}

    <!-- Background behind hour markers -->
    <div
      class="bg-background absolute top-0 bottom-0 left-0 z-10 w-15 transition-all duration-200"
      style:bottom={`${scale * 60 - 5}px`}
    ></div>

    <!-- Background above week markers -->
    <div
      class="bg-background absolute -top-5 left-0 z-20 h-6 w-15 transition-all duration-200"
    ></div>

    <!-- Current Time Indicator Time Bubble -->
    {#if !isLoading && curTimeIndicator}
      {@const isToday = toCalendarDate($clock).toString() === today(getLocalTimeZone()).toString()}
      {#if isToday && !isAfterHours && !isBeforeHours}
        {@const top =
          focusAdjustment +
          curTimeIndicator.hour * hourSize +
          (curTimeIndicator.minute / 60) * hourSize -
          earliestStartHour * hourSize}
        <div
          class="pointer-events-none absolute right-0 left-0 z-20 flex h-1 items-center transition-all duration-200 select-none"
          style:top={`${top}px`}
        >
          <Text style="xs" class="z-90 -ml-1 rounded-full bg-red-500 px-1 text-white">
            {Intl.DateTimeFormat(getLocale(), {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: getLocalTimeZone().toString(),
            }).format(toCalendarDateTime($clock).toDate(getLocalTimeZone()))}
          </Text>
        </div>
      {/if}
    {/if}
  </div>
{/if}
