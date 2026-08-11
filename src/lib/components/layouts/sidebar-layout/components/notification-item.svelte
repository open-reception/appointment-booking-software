<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { m } from "$i18n/messages";
  import { getStaffKeyShares } from "$lib/client/crypto";
  import { Button } from "$lib/components/ui/button";
  import { Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { stringToEncryptedData } from "$lib/crypto/utils";
  import { auth } from "$lib/stores/auth";
  import { channels as channelsStore } from "$lib/stores/channels";
  import { staffCrypto } from "$lib/stores/staff-crypto";
  import { tenants } from "$lib/stores/tenants";
  import type { TAppointment } from "$lib/types/appointments";
  import type { TNotification } from "$lib/types/notification";
  import { toDisplayDateTime } from "$lib/utils/datetime";
  import { getCurrentTranlslation } from "$lib/utils/localizations";
  import { getLocalTimeZone } from "@internationalized/date";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { onMount } from "svelte";

  let {
    item,
    closePopover,
  }: {
    item: TNotification;
    closePopover: () => void;
  } = $props();

  const queryClient = useQueryClient();
  const channels = $derived($channelsStore.channels);
  const tenant = $derived($tenants.currentTenant);
  let appointment: TAppointment | undefined = $state();
  let decrypted: { name?: string; email?: string; phone?: string } | undefined = $state();

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

  const decryptPayload = async () => {
    if (item.metaData?.encryptedPayload) {
      if (!$staffCrypto.isAuthenticated || !$staffCrypto.crypto) {
        const maxWaitTime = 5000; // 5 seconds
        const startTime = Date.now();

        while (!$staffCrypto.isAuthenticated && Date.now() - startTime < maxWaitTime) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (!$staffCrypto.isAuthenticated || !$staffCrypto.crypto) {
          console.error("Staff crypto not initialized after waiting");
          return;
        }
      }

      const data = stringToEncryptedData(item.metaData?.encryptedPayload);
      if (data) {
        if (!item.metaData?.tunnelId) {
          console.error("Missing tunnelId in notification metadata");
          return;
        }

        if (tenant === null) {
          console.error("Missing tenant to decrypt encrypted notification payload");
        }

        const staffKeyShares = await getStaffKeyShares(tenant!.id, item.metaData.tunnelId);

        // TODO: When multiple staffKeyShares are supported, select the one currently in use
        const staffKeyShare = staffKeyShares[0];

        decrypted = await $staffCrypto.crypto.decryptStaff({
          data,
          staffKeyShare: staffKeyShare.encryptedTunnelKey,
        });
      }
    }
  };

  onMount(() => {
    if (item.metaData?.appointmentId) {
      getAppointment(item.metaData.appointmentId);
      decryptPayload();
    }
  });
</script>

<Button
  variant="ghost"
  class="flex h-auto w-full shrink flex-col items-start gap-1 rounded-none px-3 last:rounded-b-md focus:ring-inset"
  onclick={() => {
    if (appointment) {
      closePopover();
      queryClient.invalidateQueries({
        queryKey: ["calendar"],
      });
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
      {toDisplayDateTime(new Date(appointment.appointmentDate), {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: getLocalTimeZone(),
        timeZoneName: "short",
      })}
    </Text>
  {:else if item.metaData?.appointmentDate}
    <Text
      style="xs"
      class="text-muted-foreground -mb-1 flex pr-8 text-start font-light whitespace-break-spaces"
    >
      {toDisplayDateTime(new Date(item.metaData?.appointmentDate), {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: getLocalTimeZone(),
        timeZoneName: "short",
      })}
    </Text>
  {/if}
  <Text style="md" class="flex pr-8 text-start whitespace-break-spaces">
    {#if item.type === "APPOINTMENT_REQUESTED"}
      {m["notifications.types.APPOINTMENT_REQUESTED.title"]()}
    {:else if item.type === "APPOINTMENT_CONFIRMED"}
      {m["notifications.types.APPOINTMENT_CONFIRMED.title"]()}
    {:else if item.type === "APPOINTMENT_CANCELLED"}
      {m["notifications.types.APPOINTMENT_CANCELLED.title"]()}
    {/if}
  </Text>
  {@const possibleChannelIds = [item.metaData?.channelId, appointment?.channelId]}
  {@const channel = channels.find((c) => possibleChannelIds.includes(c.id))}
  {#if channel}
    {@const channelName = getCurrentTranlslation(channel.names)}
    <Text style="xs" class="text-muted-foreground flex w-full text-start whitespace-break-spaces">
      {m["channels.singular"]()}: {channelName}
    </Text>
  {/if}
  {#if decrypted?.name}
    <Text style="xs" class="text-muted-foreground flex w-full text-start whitespace-break-spaces">
      {m["form.name"]()}: {decrypted.name || m["unkown"]()}
    </Text>
  {/if}
  {#if decrypted?.email}
    <Text style="xs" class="text-muted-foreground flex w-full text-start whitespace-break-spaces">
      {m["form.email"]()}:
      <a href={`mailto:${decrypted.email}`} class="underline">{decrypted.email}</a>
    </Text>
  {/if}
  {#if decrypted?.phone}
    <Text style="xs" class="text-muted-foreground flex w-full text-start whitespace-break-spaces">
      {m["form.phone"]()}:
      <a href={`tel:${decrypted.phone}`} class="underline">{decrypted.phone}</a>
    </Text>
  {/if}
</Button>
