<script lang="ts">
  import { m } from "$i18n/messages";
  import { getLocale } from "$i18n/runtime";
  import { Button } from "$lib/components/ui/button";
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
  import { PanelRightClose } from "@lucide/svelte";
  import { type ComponentProps } from "svelte";

  let {
    shownAppointments = $bindable(),
    shownChannels = $bindable(),
    shownAgents = $bindable(),
    ref = $bindable(null),
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> & {
    shownAppointments: TAppointmentFilter;
    shownChannels: string[];
    shownAgents: string[];
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
</script>

<Sidebar.Root
  bind:ref
  collapsible="none"
  class={cn(
    "fixed top-0 right-0 h-svh border-l shadow-xl lg:sticky lg:flex lg:shadow-none",
    !sidebar.isCalendarExpanded ? "hidden lg:sticky" : "lg:sticky",
  )}
  {...restProps}
>
  <Sidebar.Header class="border-sidebar-border h-16 border-b lg:hidden">
    <div class="flex h-full items-center">
      <Button
        size="sm"
        variant="ghost"
        onclick={() => sidebarStore.setCalendarExpanded(!sidebar.isCalendarExpanded)}
      >
        <PanelRightClose />
      </Button>
    </div>
  </Sidebar.Header>
  <Sidebar.Content>
    <HorizontalPagePadding class="my-3">
      <Text style="sm">{m["calendar.shownAppointments.title"]()}</Text>
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
    </HorizontalPagePadding>
    <Sidebar.Separator class="mx-0" />
    <HorizontalPagePadding class="flex flex-col gap-4">
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
    </HorizontalPagePadding>
  </Sidebar.Content>
</Sidebar.Root>
