<script lang="ts">
  import { m } from "$i18n/messages";
  import { publicStore } from "$lib/stores/public.js";
  import { CalendarArrowDown, Check } from "@lucide/svelte/icons";

  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { Button } from "$lib/components/ui/button";
  import { Headline, Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes.js";
  import { downloadIcs, tenantAddressToIcsLocation } from "$lib/utils/ics";
  import { resest } from "./utils";
  import { getCurrentTranslation } from "$lib/utils/localizations";
  import { toast } from "svelte-sonner";

  const tenant = $derived($publicStore.tenant);
  const channels = $derived($publicStore.channels);
  const appointment = $derived($publicStore.newAppointment);
  const channel = $derived(channels?.find((c) => c.id === appointment?.channel));
</script>

<div class="flex flex-col gap-6">
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-0">
      <div class="flex items-center gap-2">
        <Check class="text-primary size-5" />
        <Headline level="h1" style="h5">
          {channel?.requiresConfirmation
            ? m["public.steps.complete.request.title"]()
            : m["public.steps.complete.book.title"]()}
        </Headline>
      </div>
      <Text style="sm" class="text-muted-foreground font-normal">
        {channel?.requiresConfirmation
          ? m["public.steps.complete.request.description"]({
              name: tenant?.longName || m["unknown"](),
            })
          : m["public.steps.complete.book.description"]()}
      </Text>
    </div>
    <div class="flex flex-col-reverse items-center gap-2 sm:flex-row">
      <Button
        onclick={() => {
          if (tenant && channel && appointment.slot && appointment.id) {
            downloadIcs(new URL(window.location.host), [
              {
                id: appointment.id,
                isRequested: channel.requiresConfirmation,
                title: `${tenant?.longName || m["unknown"]()}: ${channel ? getCurrentTranslation(channel!.names) : m["unknown"]()}`,
                location: tenantAddressToIcsLocation(tenant.address),
                start: appointment.slot.datetime.toDate("UTC"),
                duration: appointment.slot.duration,
              },
            ]);
          } else {
            toast.error(m["public.steps.complete.download.error"]());
          }
        }}
        class="w-full sm:w-auto sm:self-start"
      >
        <CalendarArrowDown class="size-4" />
        {m["public.steps.complete.download.action"]()}
      </Button>
      <Button
        variant="ghost"
        onclick={() => {
          resest();
          goto(resolve(ROUTES.BOOK_APPOINTMENT));
        }}
        class="w-full sm:w-auto sm:self-start"
      >
        {m["public.steps.complete.action"]()}
      </Button>
    </div>
  </div>
</div>
