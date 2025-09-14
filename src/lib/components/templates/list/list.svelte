<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  let { class: className, children, ...restProps }: HTMLAttributes<HTMLOListElement> = $props();
</script>

<ol class={cn("flex w-full flex-col items-start gap-2", className)} {...restProps}>
  {@render children?.()}
</ol>
