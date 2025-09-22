<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<code bind:this={ref} class={cn("bg-muted rounded-md px-1 py-0.5", className)} {...restProps}>
  {@render children?.()}
</code>
