<script lang="ts">
  import { getLocale } from "$i18n/runtime";
  import { Button } from "$lib/components/ui/button";
  import { Text } from "$lib/components/ui/typography";
  import { type CurAppointmentItem } from "$lib/stores/calendar";
  import { getLocalTimeZone } from "@internationalized/date";
  import { Calendar, Mail, Phone } from "@lucide/svelte";

  let {
    item,
  }: {
    item: CurAppointmentItem;
  } = $props();
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
  </div>
{/if}
