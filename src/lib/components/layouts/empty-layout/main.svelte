<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  let { class: className, children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
  class={cn(
    "flex grow flex-col items-center justify-center gap-5 text-center md:grow-0",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>
