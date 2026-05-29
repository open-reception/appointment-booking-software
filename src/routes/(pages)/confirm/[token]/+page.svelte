<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { m } from "$i18n/messages.js";
  import { CenteredCard } from "$lib/components/layouts";
  import { CenterState } from "$lib/components/templates/empty-state";
  import { Button } from "$lib/components/ui/button";
  import { PageWithClaim } from "$lib/components/ui/page";
  import { ROUTES } from "$lib/const/routes";
  import { Ban, Check, Drum } from "@lucide/svelte";
  import type { Error, Success } from "./types.js";

  let isSubmitting = $state(false);
  let confirmation: Error | Success | undefined = $state();
</script>

<svelte:head>
  <title>{m["confirm.title"]()} - OpenReception</title>
</svelte:head>

<PageWithClaim isWithLanguageSwitch>
  <CenteredCard.Root>
    <CenteredCard.Main>
      {#if !confirmation}
        <CenterState
          Icon={Drum}
          headline={m["setup.confirm.claim.title"]()}
          description={m["setup.confirm.claim.description"]()}
        />
      {:else if confirmation.success}
        {#if confirmation.isSetup}
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
      {#if !confirmation}
        <form
          method="POST"
          use:enhance={() => {
            isSubmitting = true;
            return async ({ result, update }) => {
              isSubmitting = false;
              if (result.type === "success" && result.data?.confirmation) {
                confirmation = result.data.confirmation as Success | Error;
              }
              await update();
            };
          }}
        >
          <Button
            size="lg"
            class="w-full"
            type="submit"
            disabled={isSubmitting}
            isLoading={isSubmitting}
          >
            {m["setup.confirm.claim.action"]()}
          </Button>
        </form>
      {:else if confirmation.success}
        {#if confirmation.isSetup}
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
            onclick={() => {
              if (confirmation?.success) {
                goto(resolve(ROUTES.SETUP_PASSKEY), {
                  state: {
                    id: confirmation.id,
                    email: confirmation.email,
                    tenantId: confirmation.tenantId,
                  },
                });
              }
            }}
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
