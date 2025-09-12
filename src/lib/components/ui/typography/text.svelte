<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";
  import { tv, type VariantProps } from "tailwind-variants";

  const variants = tv({
    variants: {
      style: {
        lg: "text-xl",
        md: "leading-5",
        sm: "text-sm/5 font-medium",
        xs: "text-xs",
      },
      color: {
        default: "",
        darker: "text-darker",
        dark: "text-dark",
        medium: "text-medium",
        light: "text-light",
        lighter: "text-lighter",
      },
    },
    defaultVariants: {
      style: "xs",
      color: "default",
    },
  });

  let {
    ref = $bindable(null),
    style,
    color = "default",
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLSpanElement>> & {
    style: VariantProps<typeof variants>["style"];
    color?: VariantProps<typeof variants>["color"];
  } = $props();
</script>

<span bind:this={ref} class={cn(variants({ style, color }), className)} {...restProps}>
  {@render children?.()}
</span>
