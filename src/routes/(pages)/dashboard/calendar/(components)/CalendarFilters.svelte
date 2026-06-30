<script lang="ts">
  import { m } from "$i18n/messages";
  import { getLocale } from "$i18n/runtime";
  import CalendarWeekWorkdays from "$lib/assets/custom-icons/calendar-week-workdays.svelte";
  import CalendarWeek from "$lib/assets/custom-icons/calendar-week.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import { CheckboxWithLabel } from "$lib/components/ui/checkbox-with-label";
  import { Label } from "$lib/components/ui/label";
  import { HorizontalPagePadding } from "$lib/components/ui/page";
  import * as RadioGroup from "$lib/components/ui/radio-group";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Text } from "$lib/components/ui/typography";
  import { agents as agentsStore } from "$lib/stores/agents";
  import { channels as channelsStore } from "$lib/stores/channels";
  import { sidebar as sidebarStore } from "$lib/stores/sidebar";
  import type { TAppointmentFilter } from "$lib/types/calendar";
  import { cn } from "$lib/utils";
  import { CalendarDate, type DateValue, isWeekend } from "@internationalized/date";
  import { Calendar, FunnelX, PanelRightClose, ZoomIn, ZoomOut } from "@lucide/svelte";
  import { type ComponentProps } from "svelte";
  import type { CalendarView } from "../types";
  import CalendarMonth from "./CalendarMonth.svelte";
  import { CALENDAR_ZOOM_STEPS } from "./utils";

  let {
    shownAppointments = $bindable(),
    shownChannels = $bindable(),
    shownAgents = $bindable(),
    scale = $bindable(),
    view = $bindable(),
    selectedDate = $bindable(),
    ref = $bindable(null),
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> & {
    shownAppointments: TAppointmentFilter;
    shownChannels: string[];
    shownAgents: string[];
    scale: number;
    view: CalendarView;
    selectedDate: CalendarDate;
  } = $props();

  const appointmentStates: { value: TAppointmentFilter; label: string }[] = [
    { value: "all", label: m["calendar.shownAppointments.options.all"]() },
    { value: "available", label: m["calendar.shownAppointments.options.available"]() },
    { value: "booked", label: m["calendar.shownAppointments.options.booked"]() },
    { value: "reserved", label: m["calendar.shownAppointments.options.reserved"]() },
  ];
  let sidebar = $derived($sidebarStore);
  let channels = $derived($channelsStore.channels.filter((x) => !x.archived));
  let agents = $derived($agentsStore.agents.filter((x) => !x.archived));

  const zoom = (direction: number) => {
    const currentIndex = CALENDAR_ZOOM_STEPS.indexOf(scale);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    scale = CALENDAR_ZOOM_STEPS[nextIndex];
    document.cookie = `calendarZoom=${CALENDAR_ZOOM_STEPS[nextIndex]}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict`;
  };

  const changeView = (newView: CalendarView) => {
    view = newView;
    document.cookie = `calendarView=${newView}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict`;
  };

  const clearFilters = () => {
    shownAppointments = "all";
    shownChannels = [];
    shownAgents = [];
  };
</script>

<Sidebar.Root
  bind:ref
  collapsible="none"
  class={cn(
    "fixed top-0 right-0 z-50 h-svh border-l shadow-xl lg:sticky lg:flex lg:shadow-none",
    !sidebar.isCalendarExpanded ? "hidden lg:sticky" : "lg:sticky",
  )}
  {...restProps}
>
  <Sidebar.Header class="border-sidebar-border h-16 border-b">
    <div class="flex h-full items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        onclick={() => sidebarStore.setCalendarExpanded(!sidebar.isCalendarExpanded)}
        class="lg:hidden"
      >
        <PanelRightClose />
      </Button>
      <ButtonGroup.Root aria-label={m["calendar.zoomOptions.title"]()}>
        <Button
          variant="outline"
          size="icon"
          disabled={CALENDAR_ZOOM_STEPS[0] === scale}
          onclick={() => zoom(-1)}
          title={m["calendar.zoomOptions.zoomOut"]()}
        >
          <ZoomOut />
          <span class="sr-only">{m["calendar.zoomOptions.zoomOut"]()}</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={CALENDAR_ZOOM_STEPS.slice(-1)[0] === scale}
          onclick={() => zoom(1)}
          title={m["calendar.zoomOptions.zoomIn"]()}
        >
          <ZoomIn />
          <span class="sr-only">{m["calendar.zoomOptions.zoomIn"]()}</span>
        </Button>
      </ButtonGroup.Root>
      <ButtonGroup.Root aria-label={m["calendar.viewOptions.title"]()}>
        <Button
          variant="outline"
          size="icon"
          onclick={() => changeView("day")}
          class={cn(view === "day" && "bg-muted")}
          title={m["calendar.viewOptions.day"]()}
        >
          <Calendar />
          <span class="sr-only">{m["calendar.viewOptions.day"]()}</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          onclick={() => changeView("week-workdays")}
          class={cn(view === "week-workdays" && "bg-muted")}
          title={m["calendar.viewOptions.week-workdays"]()}
        >
          <CalendarWeekWorkdays />
          <span class="sr-only">{m["calendar.viewOptions.week-workdays"]()}</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          onclick={() => changeView("week")}
          class={cn(view === "week" && "bg-muted")}
          title={m["calendar.viewOptions.week"]()}
        >
          <CalendarWeek />
          <span class="sr-only">{m["calendar.viewOptions.week"]()}</span>
        </Button>
      </ButtonGroup.Root>
    </div>
  </Sidebar.Header>
  <Sidebar.Content>
    <HorizontalPagePadding class="my-3">
      <div class="flex flex-col gap-4">
        <div>
          <div class="flex items-center justify-between">
            <Text style="sm">{m["calendar.shownAppointments.title"]()}</Text>
            <Button
              variant="ghost"
              size="sm"
              class="h-auto px-2 py-1"
              onclick={clearFilters}
              disabled={shownAppointments === "all" &&
                shownChannels.length === 0 &&
                shownAgents.length === 0}
            >
              <FunnelX />
              <span class="sr-only">Reset</span>
            </Button>
          </div>
          <RadioGroup.Root bind:value={shownAppointments} class="mt-2 mb-1">
            {#each appointmentStates as state (state.value)}
              <div class="flex items-center space-x-2">
                <RadioGroup.Item value={state.value} id={state.value} />
                <Label for={state.value}>
                  {state.label}
                </Label>
              </div>
            {/each}
          </RadioGroup.Root>
        </div>
        {#if channels.length > 1}
          <div>
            <Text style="sm">{m["channels.title"]()}</Text>
            {#each channels as channel (channel.id)}
              {@const locale = getLocale()}
              {@const name = channel.names[locale] || Object.values(channel.names)[0]}
              <div>
                <CheckboxWithLabel
                  value={shownChannels.includes(channel.id)}
                  label={name}
                  onCheckedChange={(v) => {
                    if (v) {
                      shownChannels = [...shownChannels, channel.id];
                    } else {
                      shownChannels = shownChannels.filter((id) => id !== channel.id);
                    }
                  }}
                  class="mt-2 mb-1"
                />
              </div>
            {/each}
          </div>
        {/if}
        {#if agents.length > 1}
          <div>
            <Text style="sm">{m["agents.title"]()}</Text>
            {#each agents as agent (agent.id)}
              <div>
                <CheckboxWithLabel
                  value={shownAgents.includes(agent.id)}
                  label={agent.name}
                  onCheckedChange={(v) => {
                    if (v) {
                      shownAgents = [...shownAgents, agent.id];
                    } else {
                      shownAgents = shownAgents.filter((id) => id !== agent.id);
                    }
                  }}
                  class="mt-2 mb-1"
                />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </HorizontalPagePadding>
    <Sidebar.Separator class="mx-0 my-1" />
    <HorizontalPagePadding class="py-2">
      <CalendarMonth
        bind:selectedDate
        {shownAppointments}
        {shownAgents}
        {shownChannels}
        onSelectDay={(v: DateValue | undefined) => {
          sidebarStore.setCalendarExpanded(!sidebar.isCalendarExpanded);
          if (view === "week-workdays" && v && isWeekend(v, getLocale())) {
            changeView("week");
          }
        }}
      />
    </HorizontalPagePadding>
  </Sidebar.Content>
</Sidebar.Root>
