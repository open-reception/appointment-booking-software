<script lang="ts">
  import { m } from "$i18n/messages";
  import { getLocale } from "$i18n/runtime";
  import Button from "$lib/components/ui/button/button.svelte";
  import { ResponsiveDialog } from "$lib/components/ui/responsive-dialog";
  import { Text } from "$lib/components/ui/typography";
  import { channels as channelsStore } from "$lib/stores/channels";
  import type { TCalendarModeMove, TCalendarSlot } from "$lib/types/calendar";
  import { utcToLocalWithoutDST } from "$lib/utils/datetime";
  import { getCurrentTranlslation } from "$lib/utils/localizations";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import SelectAgent from "./add-appointment/SelectAgent.svelte";
  import Summary from "./add-appointment/Summary.svelte";
  import type { TAddAppointment, TMoveAppointmentStep } from "./add-appointment/types";
  import { moveAppointment } from "./utils";

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
  let newAppointment: TAddAppointment = $derived({
    ...mode.appointment,
    agentId: mode.agentId,
    dateTime: utcToLocalWithoutDST(new Date(item.start)),
  });
  const channels = $derived($channelsStore.channels);
  const channel = $derived.by(() => channels.find((c) => c.id === mode.channelId));
  let isSubmitting = $state(false);

  const proceed = (data: TAddAppointment) => {
    newAppointment = {
      ...newAppointment,
      agentId: data.agentId,
    };
    step = "summary";
  };

  const submit = async () => {
    const agentId = newAppointment.agentId;
    if (!agentId) {
      toast.error(m["calendar.moveAppointment.error"]());
      return;
    }

    isSubmitting = true;

    const success = await moveAppointment({
      tenant: tenantId,
      appointment: mode.appointmentId,
      updateData: {
        agentId: agentId,
        appointmentDate: utcToLocalWithoutDST(new Date(item.start)).toISOString(),
      },
      email: newAppointment.shareEmail ? newAppointment.email : undefined,
      locale: newAppointment.locale || getLocale(),
    });
    if (success) {
      toast.success(m["calendar.moveAppointment.success"]());
      isSubmitting = false;
      updateCalendar();
    } else {
      toast.error(m["calendar.moveAppointment.error"]());
    }
  };

  onMount(() => {
    console.log("item.start", item.start);
    if (mode.agentId && item.availableAgents) {
      const availableAgents = item.availableAgents.map((it) => it.id);
      if (availableAgents.includes(mode.agentId)) {
        // selects current agent
        step = "summary";
      } else if (availableAgents.length === 1) {
        // selects only available agent
        newAppointment = {
          ...newAppointment,
          agentId: availableAgents[0],
        };
        step = "summary";
      }
    }
  });
</script>

<ResponsiveDialog
  id="current-calendar-slot"
  title={m["calendar.moveAppointment.action"]()}
  description={channel ? getCurrentTranlslation(channel.names) : undefined}
  triggerHidden={true}
>
  <Summary {step} {newAppointment} />
  {#if step === "agent" && item.availableAgents}
    <SelectAgent
      availableAgents={item.availableAgents}
      {newAppointment}
      curAgentId={newAppointment.agentId}
      {proceed}
    />
  {:else if step === "summary"}
    <div class="mt-6 flex flex-col">
      <Text style="xs" color="light" class="text-center">
        {m["calendar.notificationHint"]()}
      </Text>
      <Button onclick={submit} class="mt-5 w-full" isLoading={isSubmitting} disabled={isSubmitting}>
        {m["calendar.moveAppointment.action"]()}
      </Button>
    </div>
  {/if}
</ResponsiveDialog>
