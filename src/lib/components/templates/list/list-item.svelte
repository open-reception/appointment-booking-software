<script lang="ts">
  import { m } from "$i18n/messages";
  import { Badge, type BadgeVariant } from "$lib/components/ui/badge";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { Text } from "$lib/components/ui/typography";
  import { cn } from "$lib/utils";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import { type Component, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type ListItemActionAction = {
    type: "action";
    icon: Component;
    label: string;
    isDestructive?: boolean;
    isHidden?: boolean;
    isDisabled?: boolean;
    isMainAction?: boolean;
    onClick: () => void;
  };

  export type ListItemAction = ListItemActionAction | { type: "divider" };

  export type ListItemBadge = {
    label: string;
    variant?: BadgeVariant;
  };

  let {
    image,
    fallbackImage,
    title,
    icons,
    description,
    actions,
    badges,
  }: HTMLAttributes<HTMLLIElement> & {
    image?: string | null | Snippet;
    fallbackImage?: Component;
    title: string;
    icons?: Component[];
    description?: string;
    actions?: ListItemAction[];
    badges?: ListItemBadge[];
  } = $props();

  let open = $state(false);
  let triggerRef = $state<HTMLButtonElement>(null!);
  let mainAction = $derived.by(() => {
    return (actions || []).filter((it) => it.type === "action" && it.isMainAction === true)[0] as
      | ListItemActionAction
      | undefined;
  });
</script>

{#snippet mainBlock()}
  <div class="flex min-h-14 gap-2 p-2">
    {#if image && typeof image === "string"}
      <img
        src={image}
        alt={title}
        class="size-12 rounded-md border object-cover object-center"
        loading="lazy"
      />
    {:else if typeof image === "function"}
      {@render image()}
    {:else if fallbackImage}
      {@const Fallback = fallbackImage as Component}
      <Fallback class="bg-muted text-muted-foreground size-12 rounded-sm border stroke-1 p-1" />
    {/if}
    <div class="flex flex-col">
      <div class="flex gap-2">
        <Text
          style="sm"
          class="flex items-center justify-start gap-2 text-start text-[0.95rem] font-medium"
        >
          {title}
          {#if icons && icons.length > 0}
            <div class="flex items-center gap-1">
              {#each icons as Icon, index (`icon-${index}`)}
                <Icon class="size-3" />
              {/each}
            </div>
          {/if}
        </Text>
        {#if badges && badges.length > 0}
          <div class="flex flex-wrap gap-1 py-1">
            {#each badges as badge, index (`${badge.label}-${index}`)}
              <Badge variant={badge.variant} size="sm" class="uppercase">{badge.label}</Badge>
            {/each}
          </div>
        {/if}
      </div>
      {#if description}
        <Text style="sm" class="text-muted-foreground text-start font-normal! whitespace-normal">
          {description}
        </Text>
      {/if}
    </div>
  </div>
{/snippet}

<li class="m-0 w-full list-none p-0">
  <ButtonGroup.Root class="w-full">
    {#if mainAction}
      <Button variant="listItem" aria-label={mainAction.label} onclick={mainAction.onClick}>
        {@render mainBlock()}
      </Button>
    {:else}
      <div
        class="bg-background hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 hover:border-light hover:bg-muted box-border grow rounded-l-md border shadow-xs first:last:rounded-r-md"
      >
        {@render mainBlock()}
      </div>
    {/if}
    {#if actions && actions.length > 0}
      <DropdownMenu.Root bind:open>
        <DropdownMenu.Trigger bind:ref={triggerRef}>
          {#snippet child({ props })}
            <Button
              variant="outline"
              size="sm"
              {...props}
              aria-label={m["components.openMenu"]()}
              class="h-auto"
            >
              <EllipsisIcon />
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
                    action.isDestructive
                      ? "text-destructive data-highlighted:text-destructive"
                      : "",
                  )}
                  disabled={action.isDisabled}
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
  </ButtonGroup.Root>
</li>
