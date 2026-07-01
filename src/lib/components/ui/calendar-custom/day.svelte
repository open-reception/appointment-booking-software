<script lang="ts">
  import * as Calendar from "$lib/components/ui/calendar";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { cn } from "$lib/utils";
  import { type DateValue } from "@internationalized/date";
  import { type ComponentProps } from "svelte";

  let {
    day,
    outsideMonth,
    isDateEmpty,
    isDateHighlighted,
  }: ComponentProps<typeof Sidebar.Root> & {
    day: DateValue;
    outsideMonth: boolean;
    isDateEmpty?: (day: DateValue) => boolean;
    isDateHighlighted?: (day: DateValue) => boolean;
  } = $props();
</script>

<Calendar.Day
  class="relative data-today:rounded-sm data-today:border-2 data-today:border-red-500/50!"
>
  <div class="py-1">
    <div
      class={cn(
        isDateEmpty && isDateEmpty(day) && "text-muted-foreground",
        outsideMonth && "text-muted-foreground",
      )}
    >
      {day.day}
    </div>
    {#if isDateHighlighted && isDateHighlighted(day)}
      <span class="absolute bottom-0 left-1/2 h-1 w-1 -translate-1/2 rounded-full bg-green-500"
      ></span>
    {/if}
  </div>
</Calendar.Day>
