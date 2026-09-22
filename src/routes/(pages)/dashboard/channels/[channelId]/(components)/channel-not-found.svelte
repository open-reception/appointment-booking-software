<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { EmptyLayout } from "$lib/components/layouts";
  import { CenterState } from "$lib/components/templates/empty-state";
  import { Button } from "$lib/components/ui/button";
  import { ROUTES } from "$lib/const/routes";
  import { Ban } from "@lucide/svelte";
</script>

<EmptyLayout.Root>
  <EmptyLayout.Main>
    <CenterState
      Icon={Ban}
      headline={m["channels.edit.notFound.title"]()}
      description={m["channels.edit.notFound.description"]()}
    />
  </EmptyLayout.Main>
  <EmptyLayout.Action>
    <Button href={ROUTES.DASHBOARD.CHANNELS} class="w-full">
      {m["channels.edit.notFound.action"]()}
    </Button>
  </EmptyLayout.Action>
</EmptyLayout.Root>
