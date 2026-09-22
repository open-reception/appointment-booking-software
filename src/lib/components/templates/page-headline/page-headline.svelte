<script lang="ts">
  import { m } from "$i18n/messages";
  import { Button } from "$lib/components/ui/button";
  import { Headline, Text } from "$lib/components/ui/typography";
  import { ChevronLeft } from "@lucide/svelte";
  import type { Snippet } from "svelte";

  let {
    title,
    description,
    backHref,
    actions,
  }: {
    title: string;
    description?: string;
    backHref?: string;
    actions?: Snippet;
  } = $props();
</script>

<div class="flex items-end justify-between">
  <div class="flex flex-col pr-3">
    {#if backHref}
      <div>
        <Button href={backHref} variant="link" size="sm" class="w-auto! decoration-0">
          <ChevronLeft class="size-4" />
          {m["back"]()}
        </Button>
      </div>
    {/if}
    <Headline level="h1" style="h3">{title}</Headline>
    <Text style="sm" class="text-muted-foreground">
      {description}
    </Text>
  </div>
  {#if actions}
    <div class="flex gap-2">
      {@render actions()}
    </div>
  {/if}
</div>
