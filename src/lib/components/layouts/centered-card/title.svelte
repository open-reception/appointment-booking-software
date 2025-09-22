<script lang="ts">
  import { Headline } from "$lib/components/ui/typography";
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  let { class: className, children }: HTMLAttributes<HTMLHeadingElement> = $props();
</script>

<Headline level="h1" style="h4" class={cn(className)}>
  {@render children?.()}
</Headline>
