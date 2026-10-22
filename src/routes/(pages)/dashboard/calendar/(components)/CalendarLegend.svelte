<script lang="ts">
  import { m } from "$i18n/messages";
  import { Separator } from "$lib/components/ui/separator";
  import { CalendarDate } from "@internationalized/date";
  import Loader from "@lucide/svelte/icons/loader-2";

  let {
    day = $bindable(),
    scale = $bindable(),
    isLoading,
  }: {
    day: CalendarDate;
    scale: number;
    isLoading: boolean;
  } = $props();

  const focusAdjustment = $derived(30 * scale);
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
</div>
