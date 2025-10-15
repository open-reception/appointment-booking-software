<script lang="ts">
  import { m } from "$i18n/messages";
  import { Badge, type BadgeVariant } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { Text } from "$lib/components/ui/typography";
  import { cn } from "$lib/utils";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import { type Component } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  export type ListItemAction =
    | {
        type: "action";
        icon: Component;
        label: string;
        isDestructive?: boolean;
        onClick: () => void;
      }
    | { type: "divider" };

  export type ListItemBadge = {
    label: string;
    variant?: BadgeVariant;
  };

  let {
    image,
    title,
    description,
    descriptionOnClick,
    actions,
    badges,
  }: HTMLAttributes<HTMLLIElement> & {
    image?: string | Component;
    title: string;
    description?: string;
    descriptionOnClick?: () => void;
    actions?: ListItemAction[];
    badges?: ListItemBadge[];
  } = $props();

  let open = $state(false);
  let triggerRef = $state<HTMLButtonElement>(null!);
</script>

<li
  class="hover:border-light hover:bg-muted flex w-full items-center justify-between rounded-md border px-4 py-3"
>
  <div class="flex gap-1">
    {#if image}
      {#if typeof image === "string"}
        <img
          src={image}
          alt={title}
          class="size-10 rounded-md border object-cover object-center"
          loading="lazy"
        />
      {:else if typeof image === "function"}
        {@const Fallback = image as Component}
        <Fallback class="bg-muted text-muted-foreground size-10 rounded-sm border stroke-1 p-1" />
      {/if}
    {/if}
    <div></div>
    <div class="flex flex-col">
      <div class="flex items-center gap-2">
        <Text style="md" class="font-medium">{title}</Text>
        {#if badges && badges.length > 0}
          <div class="flex flex-wrap gap-1 py-1">
            {#each badges as badge, index (`${badge.label}-${index}`)}
              <Badge variant={badge.variant} class="uppercase">{badge.label}</Badge>
            {/each}
          </div>
        {/if}
      </div>
      {#if description}
        {#if descriptionOnClick}
          <Button
            variant="link"
            size="sm"
            onclick={descriptionOnClick}
            class="text-muted-foreground m-0 h-auto rounded-xs p-0"
          >
            {description}
          </Button>
        {:else}
          <Text style="sm" class="text-muted-foreground">
            {description}
          </Text>
        {/if}
      {/if}
    </div>
  </div>
  {#if actions && actions.length > 0}
    <DropdownMenu.Root bind:open>
      <DropdownMenu.Trigger bind:ref={triggerRef}>
        {#snippet child({ props })}
          <Button variant="outline" size="sm" {...props} aria-label={m["components.openMenu"]()}>
            <EllipsisIcon />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="w-[200px]" align="end">
        <DropdownMenu.Group>
          <DropdownMenu.Label>{m["actions"]()}</DropdownMenu.Label>
          <DropdownMenu.Separator />
          {#each actions as action, index (`action-${index}`)}
            {#if action.type === "action"}
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
</li>
