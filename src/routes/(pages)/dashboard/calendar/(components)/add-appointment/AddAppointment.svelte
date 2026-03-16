<script lang="ts">
  import { m } from "$i18n/messages";
  import { type AppointmentDataByStaff } from "$lib/client/appointment-crypto";
  import { CenterState } from "$lib/components/templates/empty-state";
  import Button from "$lib/components/ui/button/button.svelte";
  import { staffCrypto } from "$lib/stores/staff-crypto";
  import { tenants } from "$lib/stores/tenants";
  import type { TCalendarSlot } from "$lib/types/calendar";
  import { calendarItemToDate } from "$lib/utils/datetime";
  import { getDefaultAppointmentLocale } from "$lib/utils/localizations";
  import { BanIcon, Check } from "@lucide/svelte";
  import { get } from "svelte/store";
  import { ClientDataForm } from "./client-data-form";
  import { SearchClientForm } from "./search-client-form";
  import SelectAgent from "./SelectAgent.svelte";
  import Summary from "./Summary.svelte";
  import type { TAddAppointment, TAddAppointmentStep } from "./types";

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
  let newAppointment: TAddAppointment = $state({
    locale: getDefaultAppointmentLocale(get(tenants).currentTenant),
    dateTime: calendarItemToDate(item),
  });
  let isSubmitting = $state(false);

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
        if (item.availableAgents && item.availableAgents.length === 1) {
          const onlyAgent = item.availableAgents[0];
          proceed({ ...data, agentId: onlyAgent.id });
        } else {
          step = "agent";
        }
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
          step = "success";
          updateCalendar();
        })
        .catch(() => {
          step = "error";
        })
        .finally(() => {
          isSubmitting = false;
        });
    }
  };

  const onChangeLocale = (locale: string) => {
    newAppointment = { ...newAppointment, locale };
  };
</script>

<Summary {step} {newAppointment} {onChangeLocale} />
{#if step === "email"}
  <SearchClientForm {tenantId} {newAppointment} {proceed} />
{:else if step === "agent" && item.availableAgents}
  <SelectAgent availableAgents={item.availableAgents} {newAppointment} {proceed} />
{:else if step === "summary"}
  <Button onclick={addAppointment} class="w-full" isLoading={isSubmitting} disabled={isSubmitting}>
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
