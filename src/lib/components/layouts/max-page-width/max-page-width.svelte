<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import { tv, type VariantProps } from "tailwind-variants";

  const variants = tv({
    base: "mx-auto",
    variants: {
      maxWidth: {
        sm: "max-w-(--max-w-sm)",
        md: "max-w-(--max-w-md)",
        lg: "max-w-(--max-w-lg)",
        xl: "max-w-(--max-w-xl)",
      },
    },
    defaultVariants: {
      maxWidth: "lg",
    },
  });

  let {
    class: className,
    children,
    maxWidth,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & {
    maxWidth?: VariantProps<typeof variants>["maxWidth"];
  } = $props();
</script>

<div class={cn(variants({ maxWidth }), className)} {...restProps}>
  {@render children?.()}
</div>
