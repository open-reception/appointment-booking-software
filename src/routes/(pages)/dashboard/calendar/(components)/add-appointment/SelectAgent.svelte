<script lang="ts">
  import { m } from "$i18n/messages";
  import { Button } from "$lib/components/ui/button";
  import { Text } from "$lib/components/ui/typography";
  import type { CalendarAgent } from "$lib/server/services/schedule-service";
  import { agents as agentsStore } from "$lib/stores/agents";
  import UnknownItemIcon from "@lucide/svelte/icons/user-star";
  import type { TAddAppointment } from "./types";
  import { Badge } from "$lib/components/ui/badge";

  let {
    newAppointment,
    availableAgents,
    curAgentId,
    proceed,
  }: {
    newAppointment: TAddAppointment;
    availableAgents: CalendarAgent[];
    curAgentId?: string | undefined;
    proceed: (data: TAddAppointment) => void;
  } = $props();

  let agents = $derived($agentsStore.agents);
</script>

<div class="flex flex-col gap-2">
  <Text style="sm" class="block font-medium">
    {m["calendar.addAppointment.steps.agents.title"]()}
  </Text>
  <ul class="flex w-full flex-col gap-2">
    {#each availableAgents as agent (agent.id)}
      {@const agentItem = agents.find((it) => it.id === agent.id)}
      {#if agentItem}
        <li>
          <Button
            variant="outline"
            class="flex h-auto w-full cursor-pointer items-center gap-4 px-2 py-1.5 text-left"
            onclick={() => proceed({ ...newAppointment, agentId: agent.id })}
          >
            {#if agentItem.image}
              <img
                src={agentItem.image}
                alt={agentItem.name}
                class="size-8 rounded-full border object-cover object-center"
                loading="lazy"
              />
            {:else}
              <UnknownItemIcon
                class="bg-muted text-muted-foreground size-15 rounded-full border stroke-1 p-1"
              />
            {/if}
            <div class="flex grow justify-between gap-1">
              <Text style="md" class="font-medium">
                {agentItem.name}
              </Text>
              {#if curAgentId === agentItem.id}
                <Badge>
                  {m["currentSelection"]()}
                </Badge>
              {/if}
            </div>
          </Button>
        </li>
      {/if}
    {/each}
  </ul>
</div>
