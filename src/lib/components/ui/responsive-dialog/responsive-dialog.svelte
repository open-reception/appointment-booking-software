<script lang="ts" module>
  import { get, writable } from "svelte/store";

  const responsiveDialogs = writable<Map<string, boolean>>(new Map());

  export function openDialog(id: string) {
    responsiveDialogs.update((state) => {
      const newState = new SvelteMap(state);
      newState.set(id, true);
      return newState;
    });
  }

  export function closeDialog(id: string) {
    responsiveDialogs.update((state) => {
      const newState = new SvelteMap(state);
      if (newState.has(id)) {
        newState.set(id, false);
      }
      return newState;
    });
  }

  export function isOpen(id: string): boolean {
    const state = get(responsiveDialogs);
    return state.get(id) ?? false;
  }
</script>

<script lang="ts">
  import { m } from "$i18n/messages";
  import { buttonVariants, type ButtonVariant } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Drawer from "$lib/components/ui/drawer";
  import { onDestroy, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { MediaQuery, SvelteMap } from "svelte/reactivity";
  import { HorizontalPagePadding } from "../page";
  import { ScrollArea } from "../scroll-area";
  import { cn } from "$lib/utils";

  let {
    id,
    triggerLabel,
    title,
    description,
    triggerHidden = false,
    triggerVariant = "default",
    children,
  }: HTMLAttributes<HTMLDivElement> & {
    id: string;
    triggerHidden: boolean;
    triggerLabel?: Snippet | string;
    title: string;
    description?: string;
    triggerVariant?: ButtonVariant;
  } = $props();

  let open = $state(false);

  $effect(() => {
    const unsubscribe = responsiveDialogs.subscribe((value) => {
      const newValue = value.get(id);
      if (newValue !== undefined) {
        open = newValue;
      } else {
        open = false;
      }
    });
    return unsubscribe;
  });

  $effect(() => {
    if (open) {
      openDialog(id);
    } else {
      closeDialog(id);
    }
  });

  onDestroy(() => {
    responsiveDialogs.update((state) => {
      const newState = new SvelteMap(state);
      newState.delete(id);
      return newState;
    });
  });

  const isDesktop = new MediaQuery("(min-width: 768px)");
</script>

{#if isDesktop.current}
  <Dialog.Root bind:open>
    {#if !triggerHidden && triggerLabel}
      <Dialog.Trigger class={buttonVariants({ variant: triggerVariant })}>
        {#if typeof triggerLabel === "string"}
          {triggerLabel}
        {:else}
          {@render triggerLabel?.()}
        {/if}
      </Dialog.Trigger>
    {/if}
    <Dialog.Content class="max-h-[95vh] sm:max-w-106.25">
      <Dialog.Header>
        <Dialog.Title class={cn(description ? "" : "-mb-1")}>{title}</Dialog.Title>
        {#if description}
          <Dialog.Description>
            {description}
          </Dialog.Description>
        {/if}
      </Dialog.Header>
      <ScrollArea class="-mx-1 max-h-[75vh]">
        <div class="px-1 pt-2">
          {@render children?.()}
        </div>
      </ScrollArea>
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Drawer.Root bind:open>
    {#if !triggerHidden}
      <Drawer.Trigger class={buttonVariants({ variant: triggerVariant })}>
        {#if typeof triggerLabel === "string"}
          {triggerLabel}
        {:else}
          {@render triggerLabel?.()}
        {/if}
      </Drawer.Trigger>
    {/if}
    <Drawer.Content
      class="data-[vaul-drawer-direction=bottom]:max-h-[95vh] data-[vaul-drawer-direction=top]:max-h-[95vh]"
    >
      <Drawer.Header class="text-left">
        <Drawer.Title class={cn(description ? "" : "-mb-1")}>{title}</Drawer.Title>
        {#if description}
          <Drawer.Description>
            {description}
          </Drawer.Description>
        {/if}
      </Drawer.Header>
      <HorizontalPagePadding class="max-h-[95vh] overflow-y-scroll pt-2">
        {@render children?.()}
      </HorizontalPagePadding>
      <Drawer.Footer class="pt-2">
        <Drawer.Close class={buttonVariants({ variant: "outline" })}>{m.cancel()}</Drawer.Close>
      </Drawer.Footer>
    </Drawer.Content>
  </Drawer.Root>
{/if}
