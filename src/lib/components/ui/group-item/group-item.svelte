<script lang="ts">
  import { resolve } from "$app/paths";
  import { Badge, type BadgeVariant } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Item from "$lib/components/ui/item";
  import { Text } from "$lib/components/ui/typography";
  import { ChevronRight, Lock, SquarePen } from "@lucide/svelte";
  import type { Component } from "svelte";

  type TBadge = { variant: BadgeVariant; label: string };

  let {
    title,
    description,
    disabled,
    badges,
    Icon,
    href,
    onclick,
  }: {
    title: string;
    description?: string;
    disabled?: boolean;
    badges?: TBadge[];
    Icon?: Component;
    href?: string;
    onclick?: () => void;
  } = $props();

  const resolveLink = (link: string) => {
    // @ts-expect-error disabled, due to no better option to fix this type issue
    return resolve(link);
  };
</script>

{#snippet content()}
  <Item.Content>
    <Item.Title class="flex items-center gap-2">
      <Text style="md">{title}</Text>
      {#if badges && badges.length > 0}
        <div class="-mt-0.5">
          {#each badges as badge (badge.label)}
            <Badge variant={badge.variant} size="sm" class="uppercase">
              {badge.label}
            </Badge>
          {/each}
        </div>
      {/if}
    </Item.Title>
    {#if description}
      <Item.Description>
        <Text style="md">{description}</Text>
      </Item.Description>
    {/if}
  </Item.Content>
{/snippet}

{#if disabled}
  <Item.Root variant="outline">
    {#snippet child({ props })}
      <Button disabled={true} variant="groupItem" {...props}>
        {@render content()}
        <Item.Actions>
          <Lock class="size-4" />
        </Item.Actions>
      </Button>
    {/snippet}
  </Item.Root>
{:else if href}
  <Item.Root variant="outline">
    {#snippet child({ props })}
      <a href={resolveLink(href)} {...props}>
        {@render content()}
        <Item.Actions>
          <ChevronRight class="size-4" />
        </Item.Actions>
      </a>
    {/snippet}
  </Item.Root>
{:else}
  <Item.Root variant="outline">
    {#snippet child({ props })}
      <Button {...props} {onclick} variant="groupItem">
        {@render content()}
        <Item.Actions>
          {#if Icon}
            <Icon class="size-4" />
          {:else}
            <SquarePen class="size-4" />
          {/if}
        </Item.Actions>
      </Button>
    {/snippet}
  </Item.Root>
{/if}
