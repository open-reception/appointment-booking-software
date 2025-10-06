<script lang="ts">
  import { page } from "$app/state";
  import { CenteredCard } from "$lib/components/layouts";
  import { m } from "$i18n/messages";
  import { CenterState } from "$lib/components/templates/empty-state";
  import { PageWithClaim } from "$lib/components/ui/page";
  import { CircleX } from "@lucide/svelte/icons";
  import { ROUTES } from "$lib/const/routes";
  import { Button } from "$lib/components/ui/button";

  let description = "";
  switch (page.status) {
    case 404:
      description = m["errorPages.descriptions.404"]();
      break;
    default:
      description = m["errorPages.descriptions.500"]();
      break;
  }
</script>

<PageWithClaim isWithLanguageSwitch>
  <CenteredCard.Root>
    <CenteredCard.Main>
      <CenterState
        Icon={CircleX}
        headline={m["errorPages.title"]()}
        iconBadge={page.status.toString()}
        {description}
      />
    </CenteredCard.Main>
    <CenteredCard.Action>
      <Button size="lg" class="w-full" href={ROUTES.MAIN}>
        {m["errorPages.action"]()}
      </Button>
    </CenteredCard.Action>
  </CenteredCard.Root>
</PageWithClaim>
