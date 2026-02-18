<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "$i18n/messages.js";
  import type { DecryptedAppointment } from "$lib/client/appointment-crypto";
  import * as Alert from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Item from "$lib/components/ui/item";
  import { openDialog, ResponsiveDialog } from "$lib/components/ui/responsive-dialog";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Headline, Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { publicStore } from "$lib/stores/public";
  import { toDisplayDateTime } from "$lib/utils/datetime";
  import { getLocalTimeZone } from "@internationalized/date";
  import { Calendar, CircleAlert } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { appointmentStatusToBadge } from "./utils";

  let tenant = $derived($publicStore.tenant);
  let step: "loading" | "list" | "error" = $state("loading");
  let appointments: DecryptedAppointment[] = $state([]);
  let cancelling: DecryptedAppointment | undefined = $state();
  let isCancelling = $state(false);

  onMount(() => {
    getAppointments();
  });

  const getAppointments = async () => {
    if ($publicStore.crypto?.isClientAuthenticated() && tenant) {
      appointments = await $publicStore.crypto.getMyAppointments(tenant.id);
      step = "list";
    }
  };

  const cancelAppointment = async () => {
    if (!cancelling || !tenant) return;

    isCancelling = true;
    await $publicStore.crypto
      ?.cancelAppointmentByClient({
        appointment: cancelling.id,
        tenant: tenant.id,
        email: cancelling.email,
      })
      .then(() => {
        getAppointments();
        toast.success(m["clients.appointments.cancel.success"]());
        cancelling = undefined;
      })
      .catch(() => {
        toast.error(m["clients.appointments.cancel.error"]());
      })
      .finally(() => {
        isCancelling = false;
      });
  };
</script>

<div class="flex flex-col gap-3">
  <Headline level="h2" style="h3">{m["clients.appointments.title"]()}</Headline>
  {#if step === "loading"}
    <div class="flex flex-col gap-1">
      <Skeleton class="h-20 opacity-60" />
      <Skeleton class="h-20 opacity-40" />
      <Skeleton class="h-20 opacity-20" />
    </div>
    <Skeleton class="h-8 w-30 self-end" />
  {:else if step === "list"}
    {#if appointments.length > 0}
      <div class="flex flex-col gap-1">
        {#each appointments as item (item)}
          <Item.Root variant="outline">
            <Item.Content>
              <Item.Title>
                <!-- TODO: Add channel and agent; ids needed -->
                {@const badge = appointmentStatusToBadge(item.status)}
                {#if badge}
                  <Badge>{badge.label.toLocaleUpperCase()}</Badge>
                {/if}
              </Item.Title>
              <Item.Description>
                {toDisplayDateTime(new Date(item.appointmentDate), {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: getLocalTimeZone().toString(),
                })}
              </Item.Description>
            </Item.Content>
            <Item.Actions>
              <Button
                variant="outline"
                size="sm"
                onclick={() => {
                  cancelling = item;
                  openDialog("cancel-appointment");
                }}
              >
                {m["clients.appointments.cancel.action"]()}
              </Button>
            </Item.Actions>
          </Item.Root>
        {/each}
      </div>
    {:else}
      {m["clients.appointments.empty"]()}
    {/if}
    <Button href={resolve(ROUTES.MAIN)} class="self-end">
      {m["public.bookAppointment"]()}
    </Button>
  {:else if step === "error"}
    <Alert.Root variant="destructive">
      <CircleAlert />
      <Alert.Title>{m["clients.appointments.error.title"]()}</Alert.Title>
      <Alert.Description>
        {m["clients.appointments.error.description"]()}
      </Alert.Description>
    </Alert.Root>
  {/if}
</div>

{#if cancelling}
  <ResponsiveDialog
    id="cancel-appointment"
    title={m["clients.appointments.cancel.title"]()}
    description={m["clients.appointments.cancel.description"]()}
    triggerHidden={true}
  >
    <div class="flex gap-2 p-1">
      <Calendar class="size-4 " />
      <Text style="sm">
        {toDisplayDateTime(new Date(cancelling.appointmentDate), {
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

    <Button
      variant="destructive"
      onclick={cancelAppointment}
      isLoading={isCancelling}
      disabled={isCancelling}
      class="mt-5 w-full"
    >
      {m["clients.appointments.cancel.action"]()}
    </Button>
  </ResponsiveDialog>
{/if}
