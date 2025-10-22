<script lang="ts">
  import { m } from "$i18n/messages";
  import { CenteredCard } from "$lib/components/layouts";
  import { CenterState } from "$lib/components/templates/empty-state";
  import { Button } from "$lib/components/ui/button";
  import { AppointmentCard, SideBySide } from "$lib/components/ui/public";
  import { Separator } from "$lib/components/ui/separator";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { publicStore } from "$lib/stores/public.js";
  import { CircleX } from "@lucide/svelte/icons";

  const { data } = $props();
  const appointment = $derived($publicStore.newAppointment);
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
    <div class="md:flex-2/3">
      <Skeleton class="h-5 w-3/7" />
    </div>
  </SideBySide>
{:then tenant}
  {#if tenant}
    {#if tenant.confirmationState === "READY"}
      <SideBySide>
        <AppointmentCard {appointment} class="md:flex-1/3" />
        <Separator
          orientation="vertical"
          class="-my-4 mr-2 hidden !h-[calc(100%_+_var(--spacing)*8)] md:block"
        />
        <Separator class="-mx-4 -my-2 !w-[calc(100%_+_var(--spacing)*8)] md:hidden" />
        <div class="md:flex-2/3">
          <Text style="sm" class="font-medium">
            {m["public.steps.channel.title"]()}
          </Text>
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
    <!-- TODO: Add unlikely error case: promise resolved, but undefined -->
  {/if}
{/await}
