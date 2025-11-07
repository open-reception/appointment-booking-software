<script lang="ts">
  import { m } from "$i18n/messages";
  import { getLocale } from "$i18n/runtime";
  import { Button } from "$lib/components/ui/button";
  import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";

  let {
    startDate = $bindable(),
  }: {
    startDate: CalendarDate;
  } = $props();

  const prev = () => {
    const nextDate = new CalendarDate(startDate.year, startDate.month, startDate.day).subtract({
      days: 1,
    });
    startDate = nextDate;
  };

  const next = () => {
    const nextDate = new CalendarDate(startDate.year, startDate.month, startDate.day).add({
      days: 1,
    });
    startDate = nextDate;
  };

  const setToToday = () => {
    startDate = today(getLocalTimeZone());
  };
</script>

<div
  class="flex flex-col items-start justify-between gap-2 min-[500px]:flex-row min-[500px]:items-center"
>
  <div class="-ml-1 flex w-[350px] items-center justify-between gap-5">
    <Button size="sm" variant="ghost" class="h-6 !p-1" onclick={prev}>
      <ChevronLeft />
    </Button>
    <div>
      {Intl.DateTimeFormat(getLocale(), {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        timeZone: getLocalTimeZone().toString(),
      }).format(startDate.toDate(getLocalTimeZone()))}
    </div>
    <Button size="sm" variant="ghost" class="h-6 !p-1" onclick={next}>
      <ChevronRight />
    </Button>
  </div>
  <Button
    size="sm"
    variant="outline"
    onclick={setToToday}
    disabled={startDate.toString() === today(getLocalTimeZone()).toString()}
    class="-order-1 ml-auto min-[500px]:order-0"
  >
    {m["calendar.today"]()}
  </Button>
</div>
