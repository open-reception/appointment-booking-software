<script lang="ts">
  import { type TCalendarItem } from "$lib/types/calendar";
  import { cn } from "$lib/utils";
  import { getContrastColor } from "$lib/utils/color";
  import { tv } from "tailwind-variants";
  import AppointmentPreview from "./AppointmentPreview.svelte";
  import SlotPreview from "./SlotPreview.svelte";

  let {
    item,
    scale,
    earliestStartHour,
  }: {
    item: TCalendarItem & { startMinutes: number; totalColumns: number };
    scale: number;
    earliestStartHour: number;
  } = $props();

  let hourSize = $derived(60 * scale);
  let focusAdjustment = $derived(30 * scale);

  let top = $derived(
    (item.startMinutes / 60) * hourSize + focusAdjustment - earliestStartHour * hourSize,
  );
  let height = $derived(item.duration * scale);
  let width = $derived(100 / item.totalColumns);
  let left = $derived(item.column * width);

  const slotVariants = tv({
    base: "",
    variants: {
      status: {
        rejected: "border-none bg-[var(--channel-color)]", // currently not returned from back-end
        available: "border-1 border-[var(--channel-color)] bg-background",
        booked: "border-none bg-[var(--channel-color)]",
        reserved:
          "bg-[var(--channel-color)]/60 hover:bg-[var(--channel-color)]/90 border-1 border-[var(--channel-color)] border-dashed",
      },
    },
  });
</script>

<div
  class="absolute flex items-center rounded p-px transition-all duration-200 focus-within:z-10 focus-within:min-h-5 focus-within:scale-[1.02] focus-within:shadow-md focus-within:outline-3 hover:z-10 hover:min-h-5 hover:scale-[1.02] hover:shadow-md"
  style:top={`${top}px`}
  style:height={`${height}px`}
  style:left={`${left}%`}
  style:width={`${width}%`}
  data-id={item.id}
  style={item.color ? `--channel-color-contrast: ${getContrastColor(item.color)};` : undefined}
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
