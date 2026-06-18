<script lang="ts">
  import { m } from "$i18n/messages";
  import { AppointmentDetails } from "$lib/components/ui/appointment-details";
  import { Button } from "$lib/components/ui/button";
  import { Text } from "$lib/components/ui/typography";
  import { type SupportedLocale } from "$lib/const/locales";
  import { type CurAppointmentItem } from "$lib/stores/calendar";
  import { toast } from "svelte-sonner";
  import { cancelAppointment, confirmAppointment, denyAppointment } from "./utils";

  let {
    tenantId,
    item = $bindable(),
    updateCalendar,
    close,
  }: {
    tenantId: string;
    item: CurAppointmentItem;
    updateCalendar: () => void;
    close: () => void;
  } = $props();

  let isConfirming = $state(false);
  let isDenying = $state(false);
  let isDeleting = $state(false);

  const cancelItem = async () => {
    const proceed = confirm(m["calendar.cancelAppointment.confirm"]());
    if (!proceed) return;

    isDeleting = true;
    const success = await cancelAppointment({
      tenant: tenantId,
      appointment: item.appointment.id,
      email: item.decrypted.shareEmail ? item.decrypted.email : undefined,
      locale: "de", // TODO: Use client language as soon as available in appointment
    });
    if (success) {
      toast.success(m["calendar.cancelAppointment.success"]());
      updateCalendar();
      close();
    } else {
      toast.error(m["calendar.cancelAppointment.error"]());
    }
    isDeleting = false;
  };

  const denyItem = async () => {
    const proceed = confirm(m["calendar.denyAppointment.confirm"]());
    if (!proceed) return;

    isDenying = true;
    const success = await denyAppointment({
      tenant: tenantId,
      appointment: item.appointment.id,
      email: item.decrypted.shareEmail ? item.decrypted.email : undefined,
      locale: "de", // TODO: Use client language as soon as available in appointment
    });
    if (success) {
      toast.success(m["calendar.denyAppointment.success"]());
      updateCalendar();
      close();
    } else {
      toast.error(m["calendar.denyAppointment.error"]());
    }
    isDenying = false;
  };

  const confirmItem = async () => {
    isConfirming = true;
    const success = await confirmAppointment({
      tenant: tenantId,
      appointment: item.appointment.id,
      email: item.decrypted.shareEmail ? item.decrypted.email : undefined,
      locale: "de", // TODO: Use client language as soon as available in appointment
    });
    if (success) {
      toast.success(m["calendar.confirmAppointment.success"]());
      updateCalendar();
      close();
    } else {
      toast.error(m["calendar.confirmAppointment.error"]());
    }
    isConfirming = false;
  };
</script>

{#if item.appointment.appointment}
  <div class="flex flex-col items-start gap-2">
    <AppointmentDetails
      items={[
        {
          type: "client-name",
          value: item.decrypted.name,
        },
        {
          type: "client-locale",
          value: item.decrypted.locale as SupportedLocale,
        },
        {
          type: "client-email",
          value: item.decrypted.email,
        },
        {
          type: "client-phone",
          value: item.decrypted.phone,
        },
        {
          type: "date",
          value: item.appointment.appointment.dateTime,
        },
      ]}
    />
    <div class="mt-5 flex w-full flex-col gap-4">
      <Text style="xs" class="text-muted-foreground text-center">
        {m["calendar.notificationHint"]()}
      </Text>
      {#if item.appointment.status === "reserved"}
        <div class="flex flex-col gap-2">
          <Button class="w-full" disabled={isDeleting} isLoading={isDeleting} onclick={confirmItem}>
            {m["calendar.confirmAppointment.action"]()}
          </Button>
          <Button
            class="w-full"
            disabled={isConfirming || isDenying}
            isLoading={isConfirming}
            variant="destructive"
            onclick={denyItem}
          >
            {m["calendar.denyAppointment.action"]()}
          </Button>
        </div>
      {:else if item.appointment.status === "booked"}
        <Button
          class="w-full"
          disabled={isConfirming || isDenying}
          isLoading={isDenying}
          variant="destructive"
          onclick={cancelItem}
        >
          {m["calendar.cancelAppointment.action"]()}
        </Button>
      {/if}
    </div>
  </div>
{/if}
