<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ButtonGroup } from "$lib/components/ui/button-group";
  import { cn } from "$lib/utils";
  import { ChevronLeft, ChevronRight } from "@lucide/svelte/icons";
  import type { HTMLAttributes } from "svelte/elements";
  import { cubicOut, cubicIn } from "svelte/easing";
  import type { TransitionConfig } from "svelte/transition";
  import { m } from "$i18n/messages";
  import { sidebar } from "$lib/stores/sidebar";
  import { innerWidth } from "svelte/reactivity/window";

  let {
    children,
    hours,
    scale,
    shownAgents,
    isCalendarScrollableRight = $bindable(),
  }: {
    hours: { from: number; to: number };
    scale: number;
    shownAgents: string[];
    isCalendarScrollableRight: boolean;
  } & HTMLAttributes<HTMLDivElement> = $props();

  let calendarArea = $state<HTMLDivElement>();
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);

  let posOffsetSidebarLeft = $derived(
    (innerWidth.current ?? 0) >= 768 ? ($sidebar.isOpen ? 140 : 32) : 0,
  );
  let posOffsetSidebarRight = $derived((innerWidth.current ?? 0) >= 1024 ? -136 : 0);

  function scroll(direction: -1 | 1) {
    calendarArea?.scrollBy({ left: direction * 200, behavior: "smooth" });
  }

  function scrollingCalendarArea() {
    if (!calendarArea) return;
    canScrollLeft = calendarArea.scrollLeft > 0;
    canScrollRight =
      Math.ceil(calendarArea.scrollLeft + calendarArea.clientWidth) < calendarArea.scrollWidth;
    isCalendarScrollableRight = canScrollRight;
  }

  function slideFade(
    node: Element,
    { duration = 400, from = "100vw" }: { duration?: number; from?: string } = {},
  ): TransitionConfig {
    return {
      duration,
      css: (t) => {
        const move = 1 - cubicOut(t);
        const fade = cubicIn(t);
        return `
          transform: translateY(calc(${from} * ${move}));
          opacity: ${fade};
        `;
      },
    };
  }

  $effect(() => {
    if (!calendarArea) return;
    scrollingCalendarArea();
    const observer = new ResizeObserver(scrollingCalendarArea);
    observer.observe(calendarArea);
    return () => observer.disconnect();
  });

  // Auto-enables scrolling design, when shownAgents changes
  $effect(() => {
    if (shownAgents) {
      scrollingCalendarArea();
    }
  });
</script>

{#if canScrollLeft || canScrollRight}
  <div
    class={cn(
      "bg-accent fixed bottom-10 left-1/2 z-30 flex -translate-x-1/2 transform justify-center rounded-lg p-2 shadow-xl transition-all duration-200",
    )}
    style:margin-left={`${posOffsetSidebarLeft + posOffsetSidebarRight}px`}
    transition:slideFade={{ from: "100vw" }}
  >
    <ButtonGroup>
      <Button
        variant="outline"
        size="iconSm"
        onclick={() => scroll(-1)}
        disabled={!canScrollLeft}
        title={m["calendar.scrollOptions.scrollLeft"]()}
      >
        <ChevronLeft />
        <span class="sr-only">{m["calendar.scrollOptions.scrollLeft"]()}</span>
      </Button>
      <Button
        variant="outline"
        size="iconSm"
        onclick={() => scroll(1)}
        disabled={!canScrollRight}
        title={m["calendar.scrollOptions.scrollRight"]()}
      >
        <ChevronRight />
        <span class="sr-only">{m["calendar.scrollOptions.scrollRight"]()}</span>
      </Button>
    </ButtonGroup>
  </div>
{/if}

<!-- pt-5 is to show overflowing weekdays in weekview -->
<div
  bind:this={calendarArea}
  onscroll={scrollingCalendarArea}
  class={cn(
    "flex overflow-x-auto pt-5 transition-all duration-200",
    isCalendarScrollableRight ? "-mr-4 pr-4" : "",
  )}
  style:min-height={`${(hours.to - hours.from) * 60 * scale + 90 * scale}px`}
  data-id="calendar-area"
>
  {@render children?.()}
</div>
