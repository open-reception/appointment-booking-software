<script lang="ts">
  import { m } from "$i18n/messages";
  import { CenterState } from "$lib/components/templates/empty-state";
  import Button from "$lib/components/ui/button/button.svelte";
  import type { TCalendarSlot } from "$lib/types/calendar";
  import { calendarItemToDate } from "$lib/utils/datetime";
  import { BanIcon, Check } from "@lucide/svelte";
  import { SearchClientForm } from "./search-client-form";
  import SelectAgent from "./SelectAgent.svelte";
  import Summary from "./Summary.svelte";
  import type { TAddAppointment, TAddAppointmentStep } from "./types";
  import { ClientDataForm } from "./client-data-form";

  let {
    tenantId,
    item = $bindable(),
    updateCalendar,
  }: {
    tenantId: string;
    item: TCalendarSlot;
    updateCalendar: () => void;
  } = $props();

  let step: TAddAppointmentStep = $state("email");
  let newAppointment: TAddAppointment = $state({ dateTime: calendarItemToDate(item) });

  const proceed = (data: TAddAppointment) => {
    switch (true) {
      case Boolean(data.name): {
        newAppointment = {
          ...data,
        };
        step = "summary";
        break;
      }
      case Boolean(data.agentId): {
        newAppointment = {
          ...data,
        };
        step = "client";
        break;
      }
      case Boolean(data.email) || data.hasNoEmail: {
        newAppointment = {
          ...data,
        };
        step = "agent";
        break;
      }
    }
  };

  const addAppointment = async () => {
    console.log("adding appointment", newAppointment);
    updateCalendar();
    step = "success";
  };
</script>

<Summary {step} {newAppointment} />
{#if step === "email"}
  <SearchClientForm {tenantId} {newAppointment} {proceed} />
{:else if step === "agent" && item.availableAgents}
  <SelectAgent availableAgents={item.availableAgents} {newAppointment} {proceed} />
{:else if step === "summary"}
  <Button onclick={addAppointment} class="w-full">
    {m["calendar.addAppointment.steps.summary.action"]()}
  </Button>
{:else if step === "client"}
  <ClientDataForm {newAppointment} {proceed} />
{:else if step === "success"}
  <CenterState
    headline={m["calendar.addAppointment.steps.success.title"]()}
    description={m["calendar.addAppointment.steps.success.description"]()}
    Icon={Check}
    size="sm"
  />
{:else}
  <CenterState
    headline={m["calendar.addAppointment.steps.error.title"]()}
    description={m["calendar.addAppointment.steps.error.description"]()}
    Icon={BanIcon}
    size="sm"
  />
{/if}
