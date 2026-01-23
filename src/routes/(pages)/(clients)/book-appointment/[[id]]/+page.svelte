<script lang="ts">
  import { m } from "$i18n/messages";
  import { CenteredCard } from "$lib/components/layouts";
  import { CenterState } from "$lib/components/templates/empty-state";
  import { Button } from "$lib/components/ui/button";
  import { AppointmentCard, SideBySide } from "$lib/components/ui/public";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { ROUTES } from "$lib/const/routes";
  import { publicStore } from "$lib/stores/public.js";
  import { CircleX } from "@lucide/svelte/icons";
  import { AddPersonalDataForm } from "./(components)/add-personal-data-form";
  import SelectAgent from "./(components)/select-agent.svelte";
  import SelectChannel from "./(components)/select-channel.svelte";
  import SelectSlot from "./(components)/select-slot.svelte";
  import { proceed } from "./(components)/utils";
  import AuthTabs from "./(components)/auth/auth-tabs.svelte";
  import Summary from "./(components)/summary.svelte";

  const { data } = $props();
  const appointment = $derived($publicStore.newAppointment);

  $effect(() => {
    if (data.channelId && appointment?.step === "SELECT_CHANNEL") {
      proceed({ ...appointment, channel: data.channelId });
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
    <Skeleton class="h-15 md:h-full md:flex-1/3" />
    <div class="flex flex-col gap-4 p-3 md:flex-2/3">
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
        <div class="p-3 md:flex-2/3">
          {#await data.streaming.channels}
            <div class="flex flex-col gap-2">
              <Skeleton class="h-12 w-full opacity-65" />
              <Skeleton class="h-12 w-full opacity-50" />
              <Skeleton class="h-12 w-full opacity-35" />
            </div>
          {:then channels}
            {#if appointment.step === "SUMMARY"}
              <Summary />
            {:else if appointment.step === "LOGIN"}
              <AuthTabs {proceed} />
            {:else if appointment.step === "ADD_PERSONAL_DATA"}
              <AddPersonalDataForm {proceed} />
            {:else if appointment.step === "SELECT_SLOT" && appointment.channel && appointment.agent !== undefined}
              <SelectSlot channel={appointment.channel} agent={appointment.agent} {proceed} />
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
