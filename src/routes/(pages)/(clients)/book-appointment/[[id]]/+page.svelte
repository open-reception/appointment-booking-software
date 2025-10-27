<script lang="ts">
  import { m } from "$i18n/messages";
  import { CenteredCard } from "$lib/components/layouts";
  import { CenterState } from "$lib/components/templates/empty-state";
  import { Button } from "$lib/components/ui/button";
  import { AppointmentCard, SideBySide } from "$lib/components/ui/public";
  import { Separator } from "$lib/components/ui/separator";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { ROUTES } from "$lib/const/routes";
  import { publicStore } from "$lib/stores/public.js";
  import { CircleX } from "@lucide/svelte/icons";
  import SelectAgent from "./(components)/select-agent.svelte";
  import SelectChannel from "./(components)/select-channel.svelte";
  import { proceed } from "./(components)/utils";

  const { data } = $props();
  const appointment = $derived($publicStore.newAppointment);

  $effect(() => {
    if (data.channelId && appointment?.step === "SELECT_CHANNEL") {
      proceed({ ...appointment, channel: data.channelId });
    } else {
      proceed({});
    }
  });
</script>

<svelte:head>
  {#await data.streaming.tenant}
    <title>{m["public.bookAppointment"]()} - OpenReception</title>
  {:then tenant}
    {#if tenant}
      <title>{m["public.bookAppointment"]()} - {tenant.longName} - OpenReception</title>
    {/if}
  {/await}
</svelte:head>

{#await data.streaming.tenant}
  <SideBySide>
    <Skeleton class="h-15 md:flex-1/3" />
    <Separator
      orientation="vertical"
      class="-my-4 mr-2 hidden !h-[calc(100%_+_var(--spacing)*8)] md:block"
    />
    <Separator class="-mx-4 -my-2 !w-[calc(100%_+_var(--spacing)*8)] md:hidden" />
    <div class="flex flex-col gap-4 md:flex-2/3">
      <Skeleton class="h-5 w-3/7" />
      <div class="flex flex-col gap-2">
        <Skeleton class="h-12 w-full opacity-65" />
        <Skeleton class="h-12 w-full opacity-50" />
        <Skeleton class="h-12 w-full opacity-35" />
      </div>
    </div>
  </SideBySide>
{:then tenant}
  {#if tenant}
    {#if tenant.setupState === "READY" && tenant.longName}
      <SideBySide>
        <AppointmentCard {appointment} class="md:flex-1/3" />
        <Separator
          orientation="vertical"
          class="-my-4 mr-2 hidden !h-[calc(100%_+_var(--spacing)*8)] md:block"
        />
        <Separator class="-mx-4 -my-2 !w-[calc(100%_+_var(--spacing)*8)] md:hidden" />
        <div class="md:flex-2/3">
          {#await data.streaming.channels}
            <div class="flex flex-col gap-2">
              <Skeleton class="h-12 w-full opacity-65" />
              <Skeleton class="h-12 w-full opacity-50" />
              <Skeleton class="h-12 w-full opacity-35" />
            </div>
          {:then channels}
            {#if appointment.step === "SELECT_SLOT"}
              select a slot
            {:else if appointment.step === "SELECT_AGENT" && appointment.channel}
              <SelectAgent channel={appointment.channel} {proceed} />
            {:else}
              <SelectChannel {channels} {proceed} />
            {/if}
          {/await}
        </div>
      </SideBySide>
    {:else}
      <CenteredCard.Root>
        <CenteredCard.Main>
          <CenterState
            Icon={CircleX}
            headline={m["public.tenantNotReady.title"]()}
            description={m["public.tenantNotReady.description"]()}
          />
        </CenteredCard.Main>
        <CenteredCard.Action>
          <Button size="lg" class="w-full" href={ROUTES.LOGIN}>
            {m["login.action"]()}
          </Button>
        </CenteredCard.Action>
      </CenteredCard.Root>
    {/if}
  {:else}
    <CenteredCard.Root>
      <CenteredCard.Main>
        <CenterState
          Icon={CircleX}
          headline={m["public.tenantNotReady.title"]()}
          description={m["public.tenantNotReady.description"]()}
        />
      </CenteredCard.Main>
      <CenteredCard.Action>
        <Button size="lg" class="w-full" href={ROUTES.LOGIN}>
          {m["login.action"]()}
        </Button>
      </CenteredCard.Action>
    </CenteredCard.Root>
  {/if}
{/await}
