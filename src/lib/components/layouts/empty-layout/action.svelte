<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  let { children }: HTMLAttributes<HTMLDivElement> = $props();
</script>

{@render children?.()}
