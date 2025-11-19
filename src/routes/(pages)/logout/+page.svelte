<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { CenteredCard } from "$lib/components/layouts";
  import { CenterLoadingState, CenterState } from "$lib/components/templates/empty-state";
  import { Button } from "$lib/components/ui/button";
  import { PageWithClaim } from "$lib/components/ui/page";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { ROUTES } from "$lib/const/routes.js";
  import { auth } from "$lib/stores/auth.js";
  import { staffCrypto } from "$lib/stores/staff-crypto.js";
  import Check from "@lucide/svelte/icons/check";
  import { onMount } from "svelte";

  const { data } = $props();

  onMount(() => {
    auth.reset();
    staffCrypto.clear();
  });
</script>

<svelte:head>
  <title>{m["logout.title"]()} - OpenReception</title>
</svelte:head>

<PageWithClaim isWithLanguageSwitch>
  <CenteredCard.Root>
    <CenteredCard.Main>
      {#await data.streaming.success}
        <CenterLoadingState />
      {:then}
        <CenterState
          Icon={Check}
          headline={m["logout.title"]()}
          description={m["logout.description"]()}
        />
      {/await}
    </CenteredCard.Main>
    <CenteredCard.Action>
      {#await data.streaming.success}
        <Skeleton class="h-10 w-full" />
      {:then}
        <Button size="lg" class="w-full" href={ROUTES.LOGIN}>
          {m["logout.action"]()}
        </Button>
      {/await}
    </CenteredCard.Action>
  </CenteredCard.Root>
</PageWithClaim>
