<script lang="ts">
  import { m } from "$i18n/messages";
  import { Button } from "$lib/components/ui/button";
  import { LocalizedText } from "$lib/components/ui/public";
  import { Text } from "$lib/components/ui/typography";
  import { publicStore } from "$lib/stores/public.js";
  import type { TPublicAppointment, TPublicChannel } from "$lib/types/public.js";

  const {
    channels,
    proceed,
  }: { channels: TPublicChannel[]; proceed: (a: Partial<TPublicAppointment>) => void } = $props();
  const appointment = $derived($publicStore.newAppointment);
</script>

<div class="flex flex-col gap-4 pb-1">
  {#if channels.length === 0}
    <Text style="sm" class="font-medium">
      {m["public.steps.channel.empty"]()}
    </Text>
  {:else}
    <Text style="sm" class="font-medium">
      {m["public.steps.channel.title"]()}
    </Text>
    <ul class="flex flex-col gap-2">
      {#each channels as channel (channel.id)}
        <li>
          <Button
            variant="outline"
            class="hover:border-primary/30 flex h-auto w-full cursor-pointer flex-col items-start gap-1 px-3 py-2.5 text-left"
            onclick={() =>
              proceed({
                ...appointment,
                channel: channel.id,
              })}
          >
            <Text style="md" class="font-medium">
              <LocalizedText translations={channel.names} />
            </Text>
            {#if Object.keys(channel.descriptions).length > 0}
              <Text style="md" class="text-muted-foreground font-normal whitespace-pre-line">
                <LocalizedText translations={channel.descriptions} />
              </Text>
            {/if}
          </Button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
