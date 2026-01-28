<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { m } from "$i18n/messages";
  import { getLocale } from "$i18n/runtime";
  import { Button } from "$lib/components/ui/button";
  import { Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { channels as channelsStore } from "$lib/stores/channels";
  import type { TAppointment } from "$lib/types/appointments";
  import type { TNotification } from "$lib/types/notification";
  import { getCurrentTranlslation } from "$lib/utils/localizations";
  import { getLocalTimeZone, parseAbsolute } from "@internationalized/date";
  import { onMount } from "svelte";

  let {
    item,
    closePopover,
  }: {
    item: TNotification;
    closePopover: () => void;
  } = $props();

  const channels = $derived($channelsStore.channels);
  let appointment: TAppointment | undefined = $state();

  const getAppointment = async (id: string) => {
    try {
      const tenantId = auth.getTenant();
      const res = await fetch(`/api/tenants/${tenantId}/appointments/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      });

      const body = await res.json();
      appointment = body.appointment;
    } catch (error) {
      console.error("Failed to fetch/parse appointment detail response", { error });
    }
  };

  onMount(() => {
    if (item.metaData?.appointmentId) {
      getAppointment(item.metaData.appointmentId);
    }
  });
</script>

<Button
  variant="ghost"
  class=" flex h-auto w-full shrink flex-col items-start gap-1 rounded-none px-3 last:rounded-b-md focus:ring-inset"
  onclick={() => {
    if (appointment) {
      closePopover();
      if (page.url.pathname === ROUTES.DASHBOARD.CALENDAR) {
        goto(resolve(ROUTES.DASHBOARD.CALENDAR), {
          state: {
            isNavigatingOnCalendarPage: true,
            date: appointment.appointmentDate,
            appointmentId: appointment.id,
          },
        });
      } else {
        goto(resolve(ROUTES.DASHBOARD.CALENDAR), {
          state: {
            date: appointment.appointmentDate,
            appointmentId: appointment.id,
          },
        });
      }
    }
  }}
>
  {#if appointment}
    <Text
      style="xs"
      class="text-muted-foreground -mb-1 flex pr-8 text-start font-light whitespace-break-spaces"
    >
      {Intl.DateTimeFormat(getLocale(), {
        year: "numeric",
        month: "short",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: getLocalTimeZone().toString(),
      }).format(
        parseAbsolute(
          appointment.appointmentDate as unknown as string,
          getLocalTimeZone(),
        ).toDate(),
      )}
    </Text>
  {/if}
  <Text style="md" class="flex pr-8 text-start whitespace-break-spaces">
    {#if item.type === "APPOINTMENT_REQUESTED"}
      {m["notifications.types.APPOINTMENT_REQUESTED.title"]()}
    {/if}
  </Text>
  {#if appointment}
    <Text style="sm" class="text-muted-foreground flex w-full text-start whitespace-break-spaces">
      {#if item.type === "APPOINTMENT_REQUESTED" && appointment?.channelId}
        {@const channel = channels.find((c) => c.id === appointment?.channelId)}
        {@const channelName = getCurrentTranlslation(channel?.names)}
        {#if channelName}
          {m["notifications.types.APPOINTMENT_REQUESTED.description"]({
            channel: channelName,
          })}
        {/if}
      {/if}
    </Text>
  {/if}
</Button>
