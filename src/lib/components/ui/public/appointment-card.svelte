<script lang="ts">
  import { m } from "$i18n/messages";
  import * as Card from "$lib/components/ui/card";
  import { Headline, Text } from "$lib/components/ui/typography";
  import { publicStore } from "$lib/stores/public";
  import type { TPublicAppointment } from "$lib/types/public";
  import type { HTMLAttributes } from "svelte/elements";
  import { resest } from "../../../../routes/(pages)/(clients)/book-appointment/[[id]]/(components)/utils";
  import { Button } from "../button";
  import LocalizedText from "./localized-text.svelte";
  import { cn } from "$lib/utils";
  import { getLocalTimeZone } from "@internationalized/date";

  let {
    class: className,
    appointment,
  }: HTMLAttributes<HTMLDivElement> & { appointment?: TPublicAppointment } = $props();
  const tenant = $derived($publicStore.tenant);
  const channels = $derived($publicStore.channels || []);
  const channel = $derived(channels.find((ch) => ch.id === appointment?.channel));
</script>

{#if tenant && appointment}
  <Card.Root class={cn("rounded-lg p-3", className)}>
    <Card.Title class="flex gap-3">
      {#if typeof tenant.logo === "string" && tenant.logo}
        <img
          src={tenant.logo}
          alt={tenant.longName}
          class="border-muted block size-15 rounded-lg border object-cover object-center"
          loading="lazy"
        />
      {/if}
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-1">
          <Headline level="h1" style="h6">
            {tenant?.longName}
          </Headline>
          <Text style="xs" color="medium" class="font-normal whitespace-pre-line">
            {m["public.bookAppointment"]()}
          </Text>
        </div>
        {#if channel}
          <div class="flex flex-col gap-3">
            <div>
              <Text style="sm">
                <LocalizedText translations={channel.names} />
              </Text>
              <Button
                onclick={() => resest()}
                variant="link"
                size="xs"
                class="text-normal text-muted-foreground h-auto p-0 font-normal"
              >
                {m.edit()}
              </Button>
              {#if appointment.agent || appointment.agent === null}
                <br />
                <Text style="sm" class="font-normal">
                  {appointment.agent?.name || m["public.anyAgent"]()}
                </Text>
              {/if}
            </div>
            {#if appointment.slot}
              <div>
                <Text style="sm" class="font-normal">
                  {Intl.DateTimeFormat($publicStore.locale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: getLocalTimeZone().toString(),
                  }).format(appointment.slot.datetime.toDate(getLocalTimeZone()))}
                </Text>
              </div>
            {/if}
            {#if appointment.data}
              <div>
                <Text style="sm" class="font-normal">
                  {appointment.data.name}<br />
                  {appointment.data.email}
                  {#if appointment.data.phone}
                    <br />
                    {appointment.data.phone}
                  {/if}
                </Text>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </Card.Title>
  </Card.Root>
{/if}
