<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  let { class: className, children, ...restProps }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<div class={cn("grid grid-cols-1 gap-10 md:grid-cols-2 xl:grid-cols-3", className)} {...restProps}>
  {@render children?.()}
</div>
