<script lang="ts">
  import { m } from "$i18n/messages";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { channels as channelsStore } from "$lib/stores/channels";
  import type { TAppointmentFilter, TCalendarMode } from "$lib/types/calendar";
  import { toDisplayDateTime } from "$lib/utils/datetime";
  import { getCurrentTranlslation } from "$lib/utils/localizations";
  import { X } from "@lucide/svelte";

  let {
    mode = $bindable(),
    shownAppointments = $bindable(),
    shownChannels = $bindable(),
    shownAgents = $bindable(),
  }: {
    mode: TCalendarMode;
    shownAppointments: TAppointmentFilter;
    shownChannels: string[];
    shownAgents: string[];
  } = $props();

  let element = $state<HTMLElement>();
  let channels = $derived($channelsStore.channels);
  const channelId = mode.mode === "MOVE" ? mode.channelId : undefined;
  let channel = $derived(channelId ? channels.find((c) => c.id === channelId) : undefined);

  $effect(() => {
    element?.scrollIntoView({ behavior: "smooth" });
  });
</script>

{#if mode.mode !== "VIEW"}
  <div class="scroll-mt-4" bind:this={element}>
    <Card.Root class="bg-secondary rounded-sm p-4">
      <Card.Header class="p-0">
        <Card.Title class="text-left">
          {#if mode.mode === "MOVE"}
            {m["calendar.moveAppointment.action"]()}
            <!-- {:else if mode.mode === "FOLLOW_UP"}
            {m["calendar.followUpAppointment.action"]()} -->
          {/if}
        </Card.Title>
        <Card.Description class="text-left">
          {mode.appointment.name}
          {#if channel}
            ({getCurrentTranlslation(channel.names)})
          {/if}
          {#if mode.appointment.dateTime}
            <br />
            {toDisplayDateTime(mode.appointment.dateTime)}
          {/if}
        </Card.Description>
        <Card.Action>
          <Button
            variant="ghost"
            size="sm"
            class="-mt-2 -mr-2"
            onclick={() => {
              mode = { mode: "VIEW" };
              shownAppointments = "all";
              shownChannels = [];
              shownAgents = [];
            }}
          >
            <X class="size-4" />
            <span class="sr-only">{m["cancel"]()}</span>
          </Button>
        </Card.Action>
      </Card.Header>
    </Card.Root>
  </div>
{/if}
