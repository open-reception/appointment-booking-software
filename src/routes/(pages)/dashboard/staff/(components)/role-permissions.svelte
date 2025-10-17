<script lang="ts">
  import { m } from "$i18n/messages";
  import type { TStaff } from "$lib/types/users";
  import { cn } from "$lib/utils";
  import { Circle, CircleCheckBig } from "@lucide/svelte/icons";
  import { permissions } from "./utils";

  let { role, class: className }: { role: TStaff["role"]; class?: string } = $props();
</script>

<ul class={cn("grid grid-cols-2 gap-2", className)}>
  {#each permissions as permission (permission.label)}
    <li class="flex items-center gap-2">
      {#if permission.roles.includes(role)}
        <CircleCheckBig class="size-4 text-inherit" />
      {:else}
        <Circle class="size-4 text-inherit" />
      {/if}
      <div>{permission.label}</div>
      {#if permission.roles.includes(role)}
        <span class="sr-only">{m.yes()}</span>
      {:else}
        <span class="sr-only">{m.no()}</span>
      {/if}
    </li>
  {/each}
</ul>
