<script lang="ts">
  import { Headline, Text } from "$lib/components/ui/typography";
  import { cn } from "$lib/utils";
  import type { Snippet } from "svelte";

  let {
    title,
    description,
    class: className,
    children,
  }: { title: string; description: string; class?: string; children?: Snippet } = $props();
</script>

<div class={cn("flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-20", className)}>
  <div>
    <Headline style="h4" level="h3" class="mb-0">
      {title}
    </Headline>
    {#if description}
      <Text style="sm" class="text-muted-foreground font-normal">
        {description}
      </Text>
    {/if}
  </div>
  <div class="col-span-2">
    {@render children?.()}
  </div>
</div>
