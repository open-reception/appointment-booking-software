<script lang="ts">
  import { AppointmentDetails } from "$lib/components/ui/appointment-details";
  import { Separator } from "$lib/components/ui/separator";
  import { type SupportedLocale } from "$lib/const/locales";
  import { agents as agentsStore } from "$lib/stores/agents";
  import type { TAddAppointment, TAddAppointmentStep } from "./types";

  let {
    step,
    newAppointment,
  }: {
    step: TAddAppointmentStep;
    newAppointment: TAddAppointment;
  } = $props();

  let agent = $derived($agentsStore.agents.find((a) => a.id === newAppointment.agentId));
</script>

<AppointmentDetails
  items={[
    {
      type: "agent",
      value: agent?.name,
    },
    {
      type: "client-name",
      value: newAppointment.name,
    },
    {
      type: "client-locale",
      value: newAppointment.locale as SupportedLocale,
    },
    {
      type: "client-email",
      value: newAppointment.email,
    },
    {
      type: "client-phone",
      value: newAppointment.phone,
    },
    {
      type: "date",
      value: newAppointment.dateTime,
    },
  ]}
/>
<div class="my-5">
  {#if step !== "summary"}
    <Separator />
  {/if}
</div>
