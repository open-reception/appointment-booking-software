<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { m } from "$i18n/messages";
  import { CenteredCard } from "$lib/components/layouts";
  import { CenterLoadingState } from "$lib/components/templates/empty-state";
  import { ROUTES } from "$lib/const/routes.js";
  import { publicStore } from "$lib/stores/public";
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();
  let step: "init" | "done" = $state("init");

  $effect(() => {
    if (!$publicStore.crypto?.isClientAuthenticated()) {
      goto(resolve(ROUTES.CLIENTS.LOGIN));
    }
    setTimeout(() => (step = "done"), 500);
  });
</script>

<svelte:head>
  <title>{m["clients.title"]()} - OpenReception</title>
</svelte:head>

{#if !page.route.id?.endsWith(ROUTES.CLIENTS.LOGIN) && step === "init"}
  <CenteredCard.Root>
    <CenteredCard.Main>
      <CenterLoadingState label={m["clients.checking-auth"]()} />
    </CenteredCard.Main>
  </CenteredCard.Root>
{:else}
  {@render children()}
{/if}
