<script lang="ts">
  import { m } from "$i18n/messages";
  import { Button } from "$lib/components/ui/button";
  import type { TPublicTenant } from "$lib/types/public";

  let { tenant }: { tenant: TPublicTenant } = $props();
</script>

<div class="text-muted-foreground flex justify-center gap-2">
  {#if tenant?.links.imprint}
    <Button href={tenant?.links.imprint} size="xs" variant="link" class="text-inherit">
      {m["public.links.imprint"]()}
    </Button>
  {/if}
  {#if tenant?.links.privacyStatement}
    <Button href={tenant?.links.privacyStatement} size="xs" variant="link" class="text-inherit">
      {m["public.links.privacyStatement"]()}
    </Button>
  {/if}
</div>
