<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Text } from "$lib/components/ui/typography";
  import { type CurAppointmentItem } from "$lib/stores/calendar";
  import { getLocalTimeZone } from "@internationalized/date";
  import { Calendar, Mail, Phone, User } from "@lucide/svelte";
  import { cancelAppointment, denyAppointment, confirmAppointment } from "./utils";
  import { toast } from "svelte-sonner";
  import { m } from "$i18n/messages";
  import { toDisplayDateTime } from "$lib/utils/datetime";

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
    <div class="flex gap-2 p-1">
      <User class="size-4 " />
      <Text style="sm">
        {item.decrypted.name}
      </Text>
    </div>
    {#if item.decrypted.email || item.decrypted.phone}
      <div class="flex flex-col items-start gap-2">
        {#if item.decrypted.email}
          <Button
            class="h-auto w-auto justify-start gap-2 rounded-sm p-1"
            variant="link"
            href={`mailto:${item.decrypted.email}`}
          >
            <Mail class="size-4 " />
            {item.decrypted.email}
          </Button>
        {/if}
        {#if item.decrypted.phone}
          <Button
            class="h-auto w-auto justify-start gap-2 rounded-sm p-1"
            variant="link"
            href={`tel:${item.decrypted.phone}`}
          >
            <Phone class="size-4 " />
            {item.decrypted.phone}
          </Button>
        {/if}
      </div>
    {/if}
    <div class="flex gap-2 p-1">
      <Calendar class="size-4 " />
      <Text style="sm">
        {toDisplayDateTime(item.appointment.appointment.dateTime, {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: getLocalTimeZone().toString(),
        })}
      </Text>
    </div>
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
