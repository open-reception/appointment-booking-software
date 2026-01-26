<script lang="ts">
  import { getLocale } from "$i18n/runtime";
  import { Button } from "$lib/components/ui/button";
  import { Text } from "$lib/components/ui/typography";
  import { type CurAppointmentItem } from "$lib/stores/calendar";
  import { getLocalTimeZone } from "@internationalized/date";
  import { Calendar, Mail, Phone } from "@lucide/svelte";
  import { cancelAppointment } from "./utils";
  import { toast } from "svelte-sonner";
  import { m } from "$i18n/messages";

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

  let isDeleting = $state(false);

  const cancel = async () => {
    const proceed = confirm(m["calendar.cancelAppointment.confirm"]());
    if (!proceed) return;

    isDeleting = true;
    const success = await cancelAppointment({ tenant: tenantId, appointment: item.appointment.id });
    if (success) {
      toast.success(m["calendar.cancelAppointment.success"]());
      updateCalendar();
      close();
    } else {
      toast.error(m["calendar.cancelAppointment.error"]());
    }
    isDeleting = false;
  };
</script>

{#if item.appointment.appointment}
  <div class="flex flex-col items-start gap-3">
    <div class="flex flex-col items-start gap-2">
      <Button
        class="h-auto w-auto justify-start gap-2 rounded-sm p-1"
        variant="link"
        href={`mailto:${item.decrypted.email}`}
      >
        <Mail class="size-4 " />
        {item.decrypted.email}
      </Button>
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
    <div class="flex gap-2 p-1">
      <Calendar class="size-4 " />
      <Text style="sm">
        {Intl.DateTimeFormat(getLocale(), {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: getLocalTimeZone().toString(),
        }).format(item.appointment.appointment.dateTime)}
      </Text>
    </div>
    <div class="mt-5 flex w-full flex-col gap-4">
      <Text style="xs" class="text-muted-foreground text-center">
        {m["calendar.cancelAppointment.hint"]()}
      </Text>
      <Button
        class="w-full"
        disabled={isDeleting}
        isLoading={isDeleting}
        variant="destructive"
        onclick={cancel}
      >
        {m["calendar.cancelAppointment.action"]()}
      </Button>
    </div>
  </div>
{/if}
