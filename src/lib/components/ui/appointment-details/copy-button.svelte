<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";
  import { Check, Copy } from "@lucide/svelte";

  let {
    value,
    class: className,
  }: {
    value: string;
    class?: string;
  } = $props();
  let isCopied = $state(false);

  const copy = (
    e:
      | (MouseEvent & {
          currentTarget: EventTarget & HTMLButtonElement;
        })
      | (MouseEvent & {
          currentTarget: EventTarget & HTMLAnchorElement;
        }),
  ) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    isCopied = true;
    setTimeout(() => {
      isCopied = false;
    }, 1500);
  };
</script>

{#if value}
  <Button variant="ghost" onclick={copy} class={cn("size-2 rounded-sm px-px", className)}>
    {#if isCopied}
      <Check />
    {:else}
      <Copy />
    {/if}
  </Button>
{/if}
