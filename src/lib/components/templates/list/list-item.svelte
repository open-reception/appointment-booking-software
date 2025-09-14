<script lang="ts">
  import { m } from "$i18n/messages";
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

  let {
    title,
    description,
    descriptionOnClick,
    actions,
  }: HTMLAttributes<HTMLLIElement> & {
    title: string;
    description?: string;
    descriptionOnClick?: () => void;
    actions?: ListItemAction[];
  } = $props();

  let open = $state(false);
  let triggerRef = $state<HTMLButtonElement>(null!);
</script>

<li
  class="hover:border-light hover:bg-muted flex w-full items-center justify-between rounded-md border px-4 py-3"
>
  <div class="flex flex-col">
    <Text style="md" class="font-medium">{title}</Text>
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
