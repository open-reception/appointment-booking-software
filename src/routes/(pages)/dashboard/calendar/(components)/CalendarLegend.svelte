<script lang="ts">
  import { m } from "$i18n/messages";
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
  import Loader from "@lucide/svelte/icons/loader-2";

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
  const focusAdjustment = $derived(30 * scale);
  const curTimeIndicator = $derived(
    today(getLocalTimeZone()).toString() === day.toString() ? $clock : undefined,
  );
</script>

<div class="relative flex w-16 shrink-0 flex-col">
  <div
    class="relative flex w-full items-start justify-between transition-all duration-200"
    style:height={`${focusAdjustment}px`}
  >
    <Separator class="bg-secondary absolute top-0 right-0 left-16 h-px w-auto!" />
  </div>

  <!-- Loading state -->
  {#if isLoading}
    <div class="absolute top-0 left-0 -mt-5">
      <Loader class="size-4 animate-spin" strokeWidth={1} />
      <span class="sr-only">{m["calendar.loading"]()}</span>
    </div>
  {/if}

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
