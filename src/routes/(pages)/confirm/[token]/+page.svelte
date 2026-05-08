<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { CenteredCard } from "$lib/components/layouts";
  import { CenterState } from "$lib/components/templates/empty-state";
  import { Button } from "$lib/components/ui/button";
  import { PageWithClaim } from "$lib/components/ui/page";
  import Ban from "@lucide/svelte/icons/ban";
  import Check from "@lucide/svelte/icons/check";
  import { ROUTES } from "$lib/const/routes";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  const { data } = $props();
</script>

<svelte:head>
  <title>{m["confirm.title"]()} - OpenReception</title>
</svelte:head>

<PageWithClaim isWithLanguageSwitch>
  <CenteredCard.Root>
    <CenteredCard.Main>
      {#if data.confirmation.success}
        {#if data.confirmation.isSetup}
          <CenterState
            Icon={Check}
            headline={m["setup.confirm.success.title"]()}
            description={m["setup.confirm.success.description"]()}
          />
        {:else}
          <CenterState
            Icon={Check}
            headline={m["confirm.success.title"]()}
            description={m["confirm.success.description"]()}
          />
        {/if}
      {:else}
        <CenterState
          Icon={Ban}
          headline={m["confirm.error.title"]()}
          description={m["confirm.error.description"]()}
        />
      {/if}
    </CenteredCard.Main>
    <CenteredCard.Action>
      {#if data.confirmation.success}
        {#if data.confirmation.isSetup}
          <CenteredCard.ActionHint>
            {m["setup.confirm.success.hint"]()}
          </CenteredCard.ActionHint>
          <Button size="lg" class="w-full" href={ROUTES.LOGIN}>
            {m["setup.confirm.success.action"]()}
          </Button>
        {:else}
          <Button
            size="lg"
            class="w-full"
            onclick={() =>
              goto(resolve(ROUTES.SETUP_PASSKEY), {
                state: {
                  id: data.confirmation.id,
                  email: data.confirmation.email,
                  tenantId: data.confirmation.tenantId,
                },
              })}
          >
            {m["confirm.success.action"]()}
          </Button>
        {/if}
      {:else}
        <Button size="lg" class="w-full" href={ROUTES.RESEND_CONFIRMATION}>
          {m["confirm.error.action"]()}
        </Button>
      {/if}
    </CenteredCard.Action>
  </CenteredCard.Root>
</PageWithClaim>
