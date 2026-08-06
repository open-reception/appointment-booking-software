<script lang="ts">
  import { m } from "$i18n/messages";
  import Button from "$lib/components/ui/button/button.svelte";
  import { ResponsiveDialog } from "$lib/components/ui/responsive-dialog";
  import { agents as agentsStore } from "$lib/stores/agents";
  import { channels as channelsStore } from "$lib/stores/channels";
  import type { TAppointment } from "$lib/types/appointments";
  import type { TCalendarModeMove, TCalendarSlot } from "$lib/types/calendar";
  import { utcToLocalWithoutDST } from "$lib/utils/datetime";
  import { getCurrentTranlslation } from "$lib/utils/localizations";
  import SelectAgent from "./add-appointment/SelectAgent.svelte";
  import Summary from "./add-appointment/Summary.svelte";
  import type { TMoveAppointmentStep } from "./add-appointment/types";

  let {
    mode = $bindable(),
    tenantId,
    item = $bindable(),
    updateCalendar,
  }: {
    mode: TCalendarModeMove;
    tenantId: string;
    item: TCalendarSlot;
    updateCalendar: () => void;
  } = $props();

  let step: TMoveAppointmentStep = $state("agent");
  const channels = $derived($channelsStore.channels);
  const channel = $derived.by(() => channels.find((c) => c.id === mode.channelId));
  let agents = $derived($agentsStore.agents);
  let isSubmitting = $state(false);

  const proceed = (data: TAppointment) => {
    mode = {
      ...mode,
      agentId: data.agentId,
    };
    step = "summary";
  };

  const moveAppointment = async () => {
    isSubmitting = true;
    console.log("tenantId", tenantId);
    updateCalendar();
    // isSubmitting = false;
  };
</script>

<ResponsiveDialog
  id="current-calendar-slot"
  title={m["calendar.moveAppointment.action"]()}
  description={channel ? getCurrentTranlslation(channel.names) : undefined}
  triggerHidden={true}
>
  <Summary
    {step}
    newAppointment={{ ...mode.appointment, dateTime: utcToLocalWithoutDST(new Date(item.start)) }}
  />

  {#if step === "agent" && item.availableAgents}
    <SelectAgent
      availableAgents={item.availableAgents}
      newAppointment={{
        ...mode.appointment,
        dateTime: utcToLocalWithoutDST(new Date(item.start)),
        agentId: mode.agentId,
      }}
      {proceed}
    />
  {:else if step === "summary"}
    <Button
      onclick={moveAppointment}
      class="mt-5 w-full"
      isLoading={isSubmitting}
      disabled={isSubmitting}
    >
      {m["calendar.moveAppointment.action"]()}
    </Button>
  {/if}
</ResponsiveDialog>
