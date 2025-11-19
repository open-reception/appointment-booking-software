<script lang="ts">
  import { goto } from "$app/navigation";
  import { m } from "$i18n/messages";
  import { getLocale } from "$i18n/runtime";
  import { Button } from "$lib/components/ui/button";
  import { Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { publicStore } from "$lib/stores/public.js";
  import { getLocalTimeZone, toZoned } from "@internationalized/date";
  import { toast } from "svelte-sonner";

  const tenant = $derived($publicStore.tenant);
  const channels = $derived($publicStore.channels);
  const appointment = $derived($publicStore.newAppointment);
  const channel = $derived(channels?.find((c) => c.id === appointment?.channel));
  let isSubmitting = $state(false);

  const onSubmit = async () => {
    isSubmitting = true;
    if (
      appointment &&
      appointment.data &&
      appointment.slot &&
      appointment.agent &&
      $publicStore.crypto &&
      tenant &&
      channel
    ) {
      $publicStore.crypto
        .createAppointment(
          appointment.data,
          toZoned(appointment.slot.datetime, getLocalTimeZone()).toAbsoluteString(),
          appointment.agent.id,
          channel.id,
          appointment.slot.duration,
          tenant.id,
          Boolean(appointment.isNewClient),
          getLocale() || "de",
        )
        .then(() => {
          const isRequest = channel.requiresConfirmation;
          goto(ROUTES.APPOINTMENT_BOOKED, { state: { isRequest } });
        })
        .catch(() => {
          toast.error(m["public.steps.summary.error"]());
          isSubmitting = false;
        });
    }
    isSubmitting = false;
  };
</script>

<div class="flex flex-col gap-4 pb-1">
  <Text style="sm" class="font-medium">
    {m["public.steps.summary.title"]()}
  </Text>
  {#if channel}
    <div class="flex flex-col gap-4">
      {#if channel.requiresConfirmation}
        <Text style="xs" class="text-muted-foreground text-center">
          {m["public.steps.summary.request.hint"]()}
        </Text>
      {/if}
      <Button isLoading={isSubmitting} onclick={onSubmit}>
        {#if channel.requiresConfirmation}
          {m["public.steps.summary.request.action"]()}
        {:else}
          {m["public.steps.summary.book.action"]()}
        {/if}
      </Button>
    </div>
  {/if}
</div>
