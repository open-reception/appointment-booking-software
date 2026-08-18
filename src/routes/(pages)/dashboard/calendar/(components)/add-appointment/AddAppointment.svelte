<script lang="ts">
  import { m } from "$i18n/messages";
  import { type AppointmentDataByStaff } from "$lib/client/appointment-crypto";
  import { CenterState } from "$lib/components/templates/empty-state";
  import Button from "$lib/components/ui/button/button.svelte";
  import { closeDialog } from "$lib/components/ui/responsive-dialog";
  import { Text } from "$lib/components/ui/typography";
  import { ERRORS } from "$lib/errors";
  import { staffCrypto } from "$lib/stores/staff-crypto";
  import type { TAppointmentFilter, TCalendarMode, TCalendarSlot } from "$lib/types/calendar";
  import { utcToLocalWithoutDST } from "$lib/utils/datetime";
  import { BanIcon, Check } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { ClientDataForm } from "./client-data-form";
  import { SearchClientForm } from "./search-client-form";
  import SelectAgent from "./SelectAgent.svelte";
  import Summary from "./Summary.svelte";
  import type { TAddAppointment, TAddAppointmentStep } from "./types";

  let {
    tenantId,
    item = $bindable(),
    mode = $bindable(),
    shownAppointments = $bindable(),
    shownChannels = $bindable(),
    shownAgents = $bindable(),
    updateCalendar,
  }: {
    tenantId: string;
    item: TCalendarSlot;
    mode: TCalendarMode;
    shownAppointments: TAppointmentFilter;
    shownChannels: string[];
    shownAgents: string[];
    updateCalendar: () => void;
  } = $props();

  // Set the utc time for it to be properly saved
  const localTime = utcToLocalWithoutDST(new Date(item.start));

  let step: TAddAppointmentStep = $state("email");
  let submitErrorMessage = $state<string | null>(null);
  let newAppointment: TAddAppointment = $state({
    dateTime: localTime,
  });
  let isSubmitting = $state(false);

  const proceed = (data: TAddAppointment) => {
    switch (true) {
      case !data.agentId: {
        newAppointment = {
          ...data,
        };
        if (item.availableAgents && item.availableAgents.length === 1) {
          const onlyAgent = item.availableAgents[0];
          proceed({ ...data, agentId: onlyAgent.id });
        } else {
          step = "agent";
        }
        break;
      }
      case !data.name: {
        newAppointment = {
          ...data,
        };
        step = "client";
        break;
      }
      default: {
        newAppointment = {
          ...data,
        };
        step = "summary";
        break;
      }
    }
  };

  const addAppointment = async () => {
    if (
      newAppointment.name &&
      newAppointment.agentId &&
      typeof newAppointment.hasNoEmail !== "undefined"
    ) {
      isSubmitting = true;
      const appointmentData: AppointmentDataByStaff = {
        name: newAppointment.name,
        shareEmail: newAppointment.shareEmail || false,
        email: newAppointment.email,
        phone: newAppointment.phone,
        locale: newAppointment.locale,
      };
      await $staffCrypto.crypto
        ?.createAppointmentByStaff({
          appointmentData,
          tenantId,
          appointmentDate: newAppointment.dateTime,
          duration: item.duration,
          hasNoEmail: newAppointment.hasNoEmail,
          agentId: newAppointment.agentId,
          channelId: item.channelId,
          tunnel: newAppointment.tunnel,
          email: newAppointment.email,
        })
        .then(() => {
          submitErrorMessage = null;
          step = "success";
          mode = { mode: "VIEW" };
          updateCalendar();
        })
        .catch((error: unknown) => {
          submitErrorMessage =
            error instanceof Error && error.message === ERRORS.APPOINTMENTS.AGENT_NOT_AVAILABLE
              ? m["calendar.addAppointment.steps.error.descriptionSlotUnavailable"]()
              : m["calendar.addAppointment.steps.error.description"]();
          step = "error";
        })
        .finally(() => {
          isSubmitting = false;
        });
    }
  };

  onMount(() => {
    if (["ADD_FOLLOW_UP", "ADD_AFTER_FAIL"].includes(mode.mode)) {
      const appointment = "appointment" in mode ? mode.appointment : undefined;
      if (appointment) {
        proceed({
          ...newAppointment,
          name: appointment.name,
          email: appointment.email,
          shareEmail: appointment.shareEmail,
          phone: appointment.phone,
          locale: appointment.locale,
          hasNoEmail: Boolean(appointment.email),
        });
      }
    }
  });
</script>

<Summary {step} {newAppointment} />
{#if step === "email"}
  <SearchClientForm {tenantId} {newAppointment} {proceed} />
{:else if step === "agent" && item.availableAgents}
  <SelectAgent availableAgents={item.availableAgents} {newAppointment} {proceed} />
{:else if step === "summary"}
  <div class="flex flex-col gap-2">
    {#if newAppointment.hasNoEmail || !newAppointment.tunnel}
      <Text style="sm" color="light" class="text-center">
        {m["calendar.addAppointment.steps.summary.hint"]()}
      </Text>
    {/if}
    <Button
      onclick={addAppointment}
      class="w-full"
      isLoading={isSubmitting}
      disabled={isSubmitting}
    >
      {m["calendar.addAppointment.steps.summary.action"]()}
    </Button>
  </div>
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
    description={submitErrorMessage || m["calendar.addAppointment.steps.error.description"]()}
    Icon={BanIcon}
    size="sm"
  />
  <Button
    class="w-full"
    onclick={() => {
      if (newAppointment.name && newAppointment.shareEmail !== undefined && newAppointment.locale) {
        mode = {
          mode: "ADD_AFTER_FAIL",
          channelId: item.channelId,
          appointment: {
            name: newAppointment.name,
            email: newAppointment.email,
            shareEmail: newAppointment.shareEmail,
            phone: newAppointment.phone,
            locale: newAppointment.locale,
            hasNoEmail: Boolean(newAppointment.email),
          },
        };
        shownAppointments = "available";
        shownChannels = [item.channelId];
        if (newAppointment.agentId) {
          shownAgents = [newAppointment.agentId];
        }
        closeDialog("current-calendar-slot");
      }
    }}
  >
    {m["calendar.addAppointmentAfterFail.action"]()}
  </Button>
{/if}
