<script lang="ts">
  import { Headline, Text } from "$lib/components/ui/typography";
  import { cn } from "$lib/utils";
  import type { Component } from "svelte";
  import { tv, type VariantProps } from "tailwind-variants";

  export const variants = tv({
    base: "mx-auto mb-3",
    variants: {
      size: {
        md: "size-20",
        sm: "size-12",
      },
    },
    defaultVariants: {
      size: "md",
    },
  });

  let {
    class: className = "",
    Icon,
    iconBadge,
    headline,
    description,
    size,
  }: {
    class?: string;
    Icon: Component;
    iconBadge?: string;
    headline: string;
    description: string;
    size?: VariantProps<typeof variants>["size"];
  } = $props();

  const isSmaller = size === "sm";
</script>

<div
  class={cn(
    "mx-auto my-10 flex max-w-(--max-w-sm) grow flex-col justify-center gap-2 text-center",
    className,
  )}
>
  <div class="relative">
    {#if iconBadge}
      <div
        class="bg-secondary border-primary absolute top-1/2 left-1/2 ml-4 rounded-md border-2 px-2 pb-0.5"
      >
        <Text style="xs" class="font-mono font-medium">
          {iconBadge}
        </Text>
      </div>
    {/if}
    <Icon class={cn(variants({ size }))} strokeWidth={1} />
  </div>
  <Headline level={isSmaller ? "h3" : "h1"} style={isSmaller ? "h3" : "h2"}>
    {headline}
  </Headline>
  <Text style={isSmaller ? "md" : "lg"} class="text-medium">{description}</Text>
</div>
