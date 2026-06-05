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
  import { TriangleAlert } from "@lucide/svelte";
  import Check from "@lucide/svelte/icons/check";
  import { onMount } from "svelte";

  let success: boolean | undefined = $state();

  onMount(() => {
    logout();
  });

  const logout = async () => {
    success = undefined;
    fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    })
      .then(async (resp) => {
        if (resp.status === 200 || resp.status === 401) {
          success = true;
        } else {
          throw new Error(resp.statusText);
        }
      })
      .catch((error) => {
        console.log("Logout failed:", error);
        success = false;
      })
      .finally(() => {
        auth.reset();
        staffCrypto.clear();
      });
  };
</script>

<svelte:head>
  <title>{m["logout.title"]()} - OpenReception</title>
</svelte:head>

<PageWithClaim isWithLanguageSwitch>
  {#snippet left()}
    <Button href={ROUTES.MAIN} size="sm" variant="link">{m["home"]()}</Button>
  {/snippet}
  <CenteredCard.Root>
    <CenteredCard.Main>
      {#if success === undefined}
        <CenterLoadingState />
      {:else if success === true}
        <CenterState
          Icon={Check}
          headline={m["logout.success.title"]()}
          description={m["logout.success.description"]()}
        />
      {:else}
        <CenterState
          Icon={TriangleAlert}
          headline={m["logout.error.title"]()}
          description={m["logout.error.description"]()}
        />
      {/if}
    </CenteredCard.Main>
    <CenteredCard.Action>
      {#if success === undefined}
        <Skeleton class="h-10 w-full" />
      {:else}
        {#if success === false}
          <Button
            size="lg"
            class="w-full"
            variant="outline"
            onclick={logout}
            isLoading={success === undefined}
            disabled={success === undefined}
          >
            {m["logout.retry"]()}
          </Button>
        {/if}
        <Button size="lg" class="w-full" href={ROUTES.LOGIN}>
          {m["logout.action"]()}
        </Button>
      {/if}
    </CenteredCard.Action>
  </CenteredCard.Root>
</PageWithClaim>
