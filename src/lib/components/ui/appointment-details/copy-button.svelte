<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";
  import { Copy } from "@lucide/svelte";

  let {
    value,
    class: className,
  }: {
    value: string;
    class?: string;
  } = $props();
</script>

{#if value}
  <Button
    variant="ghost"
    onclick={(e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(value);
    }}
    class={cn("size-2 rounded-sm px-px", className)}
  >
    <Copy />
  </Button>
{/if}
