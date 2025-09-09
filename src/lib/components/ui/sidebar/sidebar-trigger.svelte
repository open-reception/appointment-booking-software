<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { cn } from "$lib/utils.js";
  import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
  import type { ComponentProps } from "svelte";
  import { useSidebar } from "./context.svelte.js";
  import { m } from "$i18n/messages";

  let {
    ref = $bindable(null),
    class: className,
    onclick,
    ...restProps
  }: ComponentProps<typeof Button> & {
    onclick?: (e: MouseEvent) => void;
  } = $props();

  const sidebar = useSidebar();
</script>

<Button
  data-sidebar="trigger"
  data-slot="sidebar-trigger"
  variant="ghost"
  size="icon"
  class={cn("size-7", className)}
  type="button"
  title={m["nav.toggleSidebar"]()}
  onclick={(e) => {
    onclick?.(e);
    sidebar.toggle();
  }}
  {...restProps}
>
  <PanelLeftIcon />
  <span class="sr-only">{m["nav.toggleSidebar"]()}</span>
</Button>
