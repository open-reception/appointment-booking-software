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
  import type { ListItemAction } from "$lib/components/templates/list/list-item.svelte";
  import { buttonVariants, type ButtonVariant } from "$lib/components/ui/button";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Drawer from "$lib/components/ui/drawer";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { cn } from "$lib/utils";
  import { Ellipsis, X } from "@lucide/svelte";
  import Loader from "@lucide/svelte/icons/loader-2";
  import { onDestroy, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { MediaQuery, SvelteMap } from "svelte/reactivity";
  import { HorizontalPagePadding } from "../page";
  import { ScrollArea } from "../scroll-area";

  let {
    id,
    triggerLabel,
    title,
    description,
    triggerHidden = false,
    triggerVariant = "default",
    isActionLoading = false,
    isDismissable = true,
    actions,
    children,
  }: HTMLAttributes<HTMLDivElement> & {
    id: string;
    triggerHidden: boolean;
    triggerLabel?: Snippet | string;
    title: string;
    description?: string;
    triggerVariant?: ButtonVariant;
    isActionLoading?: boolean;
    isDismissable?: boolean;
    actions?: ListItemAction[];
  } = $props();

  let open = $state(false);
  let actionsOpen = $state(false);

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

{#snippet actionsSnippet()}
  {#if actions && actions.length > 0}
    {#if isActionLoading === true}
      <Loader class="size-4 animate-spin" strokeWidth={1} />
    {/if}
    <DropdownMenu.Root bind:open={actionsOpen}>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button variant="ghost" size="sm" {...props} aria-label={m["components.openMenu"]()}>
            <Ellipsis />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="w-50" align="end">
        <DropdownMenu.Group>
          <DropdownMenu.Label>{m["actions"]()}</DropdownMenu.Label>
          <DropdownMenu.Separator />
          {#each actions as action, index (`action-${index}`)}
            {#if action.type === "action" && action.isHidden !== true}
              <DropdownMenu.Item
                onSelect={action.onClick}
                class={cn(
                  action.isDestructive ? "text-destructive data-highlighted:text-destructive" : "",
                )}
              >
                <action.icon
                  class={cn("mr-2 size-4", action.isDestructive ? "text-destructive" : "")}
                />
                {action.label}
              </DropdownMenu.Item>
            {:else if action.type === "divider"}
              <DropdownMenu.Separator />
            {/if}
          {/each}
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
{/snippet}

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
    <Dialog.Content
      class={cn(
        "max-h-[95vh] sm:max-w-106.25",
        // hides default close button
        actions && actions.length > 0 ? "[&>button:last-child]:hidden" : "",
      )}
      onOpenAutoFocus={(e) => e.preventDefault()}
      escapeKeydownBehavior={isDismissable === false ? "ignore" : "close"}
      interactOutsideBehavior={isDismissable === false ? "ignore" : "close"}
      showCloseButton={isDismissable === true}
    >
      <Dialog.Header class="flex flex-row items-start justify-between gap-2">
        <div class="flex flex-col gap-1 text-left">
          <Dialog.Title class={cn(description ? "" : "-mb-1")}>{title}</Dialog.Title>
          {#if description}
            <Dialog.Description>
              {description}
            </Dialog.Description>
          {/if}
        </div>
        {#if actions && actions.length > 0}
          <div class="flex items-center gap-2">
            {@render actionsSnippet?.()}
            <Dialog.Close>
              <X class="size-4" />
            </Dialog.Close>
          </div>
        {/if}
      </Dialog.Header>
      <ScrollArea class="-mx-1 max-h-[75vh] overflow-hidden">
        <div class="px-1 pt-2 pb-3">
          {@render children?.()}
        </div>
      </ScrollArea>
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Drawer.Root bind:open dismissible={isDismissable}>
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
      onOpenAutoFocus={(e) => e.preventDefault()}
      escapeKeydownBehavior={isDismissable === false ? "ignore" : "close"}
      interactOutsideBehavior={isDismissable === false ? "ignore" : "close"}
    >
      <Drawer.Header class="flex flex-row justify-between gap-2 text-left">
        <div>
          <Drawer.Title class={cn(description ? "" : "-mb-1")}>{title}</Drawer.Title>
          {#if description}
            <Drawer.Description>
              {description}
            </Drawer.Description>
          {/if}
        </div>
        <div>
          {@render actionsSnippet?.()}
        </div>
      </Drawer.Header>
      <HorizontalPagePadding class="max-h-[95vh] overflow-y-scroll pt-2">
        {@render children?.()}
      </HorizontalPagePadding>
      {#if isDismissable !== false}
        <Drawer.Footer class="pt-2">
          <Drawer.Close class={buttonVariants({ variant: "outline" })}>{m.cancel()}</Drawer.Close>
        </Drawer.Footer>
      {/if}
    </Drawer.Content>
  </Drawer.Root>
{/if}
