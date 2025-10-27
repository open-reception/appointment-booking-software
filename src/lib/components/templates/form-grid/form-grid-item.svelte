<script lang="ts">
  import { Headline } from "$lib/components/ui/typography";
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    title,
    hideTitleOnMobile,
    class: className,
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & { hideTitleOnMobile?: boolean } = $props();
</script>

<div class={cn("flex flex-col gap-3", className)} {...restProps}>
  {#if title}
    <Headline style="h5" level="h2" class={hideTitleOnMobile ? "hidden md:block" : undefined}>
      {title}
    </Headline>
  {/if}
  {@render children?.()}
</div>
