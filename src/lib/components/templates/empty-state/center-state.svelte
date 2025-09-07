<script lang="ts">
  import { cookieName } from "$i18n/runtime";
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
    headline,
    description,
    size,
  }: {
    class?: string;
    Icon: Component;
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
  <Icon class={cn(variants({ size }))} strokeWidth={1} />
  <Headline level={isSmaller ? "h3" : "h1"} style={isSmaller ? "h3" : "h2"}>
    {headline}
  </Headline>
  <Text style={isSmaller ? "md" : "lg"} class="text-medium">{description}</Text>
</div>
