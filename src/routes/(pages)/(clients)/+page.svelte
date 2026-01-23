<script lang="ts">
  import { m } from "$i18n/messages";
  import { CenteredCard } from "$lib/components/layouts";
  import { Button } from "$lib/components/ui/button";
  import { LocalizedText } from "$lib/components/ui/public/index.js";
  import { Skeleton } from "$lib/components/ui/skeleton/index";
  import { Headline, Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { Globe } from "@lucide/svelte";

  const { data } = $props();
</script>

<svelte:head>
  {#await data.streaming.tenant}
    <title>OpenReception</title>
  {:then tenant}
    {#if tenant}
      <title>{tenant.longName} - OpenReception</title>
    {/if}
  {/await}
</svelte:head>

<CenteredCard.Root>
  <CenteredCard.Main>
    {#await data.streaming.tenant}
      <div class="flex max-w-(--max-w-sm) flex-col justify-between gap-3">
        <Skeleton class="aspect-square size-20 rounded-lg" />
        <div class="mt-2 flex flex-col items-start gap-1">
          <Skeleton class="h-6 w-3/4" />
          <div class="flex w-full flex-col gap-1">
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-4 w-5/6" />
          </div>
          <Skeleton class="mt-2 h-5 w-1/3" />
        </div>
      </div>
    {:then tenant}
      {#if tenant && tenant.longName}
        <div class="flex max-w-(--max-w-sm) flex-col justify-between gap-3">
          {#if typeof tenant.logo === "string" && tenant.logo}
            <img
              src={tenant.logo}
              alt={tenant.longName}
              class="border-muted block size-20 rounded-lg border object-cover object-center"
              loading="lazy"
            />
          {/if}
          <div class="flex flex-col items-start gap-1">
            <Headline level="h1" style="h4">{tenant?.longName}</Headline>
            <Text style="md" color="medium" class="whitespace-pre-line">
              <LocalizedText translations={tenant.descriptions} />
            </Text>
            {#if tenant?.links.website}
              <Button
                href={tenant?.links.website}
                variant="link"
                class="mt-1 h-auto w-auto self-start"
                target="_blank"
              >
                <Globe />
                {m["public.links.website"]()}
              </Button>
            {/if}
          </div>
        </div>
      {:else}
        <Headline level="h1" style="h4" class="w-full text-center">
          {m["public.tenantNotReady.title"]()}
        </Headline>
        <Text style="sm" class="text-muted-foreground w-full text-center">
          {m["public.tenantNotReady.description"]()}
        </Text>
      {/if}
    {/await}
  </CenteredCard.Main>
  <CenteredCard.Action>
    {#await data.streaming.tenant}
      <Skeleton class="h-10 w-full" />
    {:then tenant}
      {#if tenant?.setupState === "READY" && tenant.longName}
        <Button size="lg" class="w-full" href={ROUTES.BOOK_APPOINTMENT}>
          {m["public.bookAppointment"]()}
        </Button>
      {:else}
        <div class="flex flex-col items-center gap-2 text-center">
          <Button size="lg" class="w-full" href={ROUTES.LOGIN}>
            {m["login.action"]()}
          </Button>
        </div>
      {/if}
    {/await}
  </CenteredCard.Action>
</CenteredCard.Root>
