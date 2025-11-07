<script lang="ts">
  import { getLocale } from "$i18n/runtime";
  import { Separator } from "$lib/components/ui/separator";
  import { Text } from "$lib/components/ui/typography";
  import { cn } from "$lib/utils";
  import { type TCalendarItem } from "$lib/types/calendar";
  import { CalendarDate, getLocalTimeZone, toCalendarDateTime } from "@internationalized/date";
  import Loader from "@lucide/svelte/icons/loader-2";
  import { m } from "$i18n/messages";

  let {
    day = $bindable(),
    items,
    earliestStartHour,
    latestEndHour,
  }: {
    day: CalendarDate;
    items: TCalendarItem[] | undefined;
    earliestStartHour: number;
    latestEndHour: number;
  } = $props();

  // Convert time string to minutes since midnight
  function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  // Process items to handle overlaps
  function processItems(items: TCalendarItem[] | undefined) {
    if (!items) return [];

    // Sort items by start time
    const sortedItems = [...items].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    // Calculate layout positions
    const processedItems = sortedItems.map((item) => {
      const startMinutes = timeToMinutes(item.start);
      const endMinutes = startMinutes + item.duration;

      return {
        ...item,
        startMinutes,
        endMinutes,
        totalColumns: 1,
      };
    });

    // Find overlapping groups and assign columns
    for (let i = 0; i < processedItems.length; i++) {
      const currentItem = processedItems[i];
      const overlappingItems = [currentItem];

      // Find all items that overlap with current item's time range
      for (let j = i + 1; j < processedItems.length; j++) {
        const nextItem = processedItems[j];

        // Check if items overlap
        if (nextItem.startMinutes < currentItem.endMinutes) {
          overlappingItems.push(nextItem);
        } else {
          break;
        }
      }

      // Assign columns to overlapping items
      if (overlappingItems.length > 1) {
        const columns: number[] = [];

        overlappingItems.forEach((item, index) => {
          // Find the first available column
          let column = 0;
          while (columns[column] !== undefined && columns[column] > item.startMinutes) {
            column++;
          }
        });

        // Update totalColumns for all overlapping items
        const maxColumns = Math.max(...overlappingItems.map((item) => item.column)) + 1;
        overlappingItems.forEach((item) => {
          item.totalColumns = maxColumns;
        });
      }
    }

    return processedItems;
  }
  let processedItems = $derived(processItems(items));

  const hours = Array.from({ length: 25 }, (_, i) => i);
  const shownHours = $derived(hours.slice(0, latestEndHour + 1).slice(earliestStartHour));
  const focusAdjustment = 30;

  // Calculate position and height for items
  function getItemStyle(item: ReturnType<typeof processItems>[0]) {
    const top = item.startMinutes - earliestStartHour * 60 + focusAdjustment;
    const height = item.duration;
    const width = 100 / item.totalColumns;
    const left = item.column * width;

    return {
      top: `${top}px`,
      height: `${height}px`,
      left: `${left}%`,
      width: `${width}%`,
    };
  }
</script>

<div class="relative flex w-full flex-col">
  <div class="relative flex min-h-[30px] w-full items-start justify-between">
    <Separator class="bg-secondary absolute top-0 right-0 left-16 h-0.25 !w-auto" />
  </div>
  {#each shownHours as hour}
    <div class="relative flex h-[60px] w-full items-start justify-between select-none">
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
      {@const style = getItemStyle(item)}
      <div
        class={cn(
          "absolute flex cursor-pointer items-center overflow-hidden rounded p-0.25 transition-all duration-200 hover:z-10 hover:min-h-5 hover:scale-[1.02] hover:shadow-md",
        )}
        style:top={style.top}
        style:height={style.height}
        style:left={style.left}
        style:width={style.width}
        data-id={item.id}
      >
        <div style:background={item.color} class="h-full w-full rounded">
          <!-- <Text style="xs" class="leading-tight">
            {item.id}
            </Text> -->
        </div>
      </div>
    {/each}
  </div>
</div>
