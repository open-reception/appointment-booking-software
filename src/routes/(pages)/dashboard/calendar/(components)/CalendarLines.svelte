<script lang="ts">
  import { getLocale } from "$i18n/runtime";
  import { Separator } from "$lib/components/ui/separator";
  import { Text } from "$lib/components/ui/typography";
  import { clock } from "$lib/stores/time";
  import {
    CalendarDate,
    getLocalTimeZone,
    toCalendarDate,
    toCalendarDateTime,
    today,
  } from "@internationalized/date";

  let {
    day = $bindable(),
    earliestStartHour,
    latestEndHour,
    scale = $bindable(),
    isLoading,
  }: {
    day: CalendarDate;
    earliestStartHour: number;
    latestEndHour: number;
    scale: number;
    isLoading: boolean;
  } = $props();

  const hourSize = $derived(60 * scale);
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const shownHours = $derived(hours.slice(0, latestEndHour + 1).slice(earliestStartHour));
  const focusAdjustment = $derived(30 * scale);
  const curTimeIndicator = $derived(
    today(getLocalTimeZone()).toString() === day.toString() ? $clock : undefined,
  );
</script>

{#if !isLoading}
  <div class="absolute flex w-[calc(100%-2rem)] flex-col">
    <div
      class="relative flex w-full items-start justify-between transition-all duration-200"
      style:height={`${focusAdjustment}px`}
    >
      <Separator class="bg-secondary absolute top-0 right-0 left-16 h-px w-auto!" />
    </div>

    <!-- Current Time Indicator -->
    {#if !isLoading && curTimeIndicator}
      {@const isToday = toCalendarDate($clock).toString() === today(getLocalTimeZone()).toString()}
      {@const isNotAfterHours =
        latestEndHour * hourSize + hourSize / 2 > curTimeIndicator.hour * hourSize}
      {@const isNotBeforeHours =
        earliestStartHour * hourSize - hourSize * 2 < curTimeIndicator.hour * hourSize}
      {#if isToday && isNotAfterHours && isNotBeforeHours}
        {@const top =
          focusAdjustment +
          curTimeIndicator.hour * hourSize +
          (curTimeIndicator.minute / 60) * hourSize -
          earliestStartHour * hourSize}
        <div
          class="pointer-events-none absolute right-0 left-0 z-10 flex h-1 items-center transition-all duration-200 select-none"
          style:top={`${top}px`}
        >
          <div class="absolute right-0 left-0 h-px bg-red-500"></div>
        </div>
      {/if}
    {/if}

    <!-- Hour markers -->
    {#each shownHours as hour (`hour-${hour}`)}
      <div
        class="relative z-0 flex w-full items-start justify-between transition-all duration-200 select-none"
        style:height={`${hourSize}px`}
      >
        <Text style="xs" class="text-muted-foreground -mt-2 w-16 shrink-0">
          {Intl.DateTimeFormat(getLocale(), {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: getLocalTimeZone().toString(),
          }).format(toCalendarDateTime(day).set({ hour }).toDate(getLocalTimeZone()))}
        </Text>
        <Separator class="bg-muted-foreground -z-10 -ml-0.5 h-px w-auto! grow" />
        <Separator class="bg-secondary absolute top-1/2 right-0 left-16 h-px w-auto!" />
      </div>
    {/each}
  </div>
{/if}
