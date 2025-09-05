<script lang="ts">
  import { Headline, Text } from "$lib/components/ui/typography";
  import { cn } from "$lib/utils";
  import type { Component } from "svelte";

  let {
    class: className = "",
    Icon,
    headline,
    description,
  }: { class?: string; Icon: Component; headline: string; description: string } = $props();
</script>

<div
  class={cn(
    "mx-auto my-10 flex max-w-(--max-w-sm) grow flex-col justify-center gap-2 text-center",
    className,
  )}
>
  <Icon class="mx-auto mb-3 size-20" strokeWidth={1} />
  <Headline level="h1" style="h2">{headline}</Headline>
  <Text style="lg" class="text-medium">{description}</Text>
</div>
