<script lang="ts">
  import { m } from "$i18n/messages";
  import * as Card from "$lib/components/ui/card";
  import { Headline, Text } from "$lib/components/ui/typography";
  import { publicStore } from "$lib/stores/public";
  import type { TPublicAppointment } from "$lib/types/public";
  import { cn } from "$lib/utils";
  import { getLocalTimeZone } from "@internationalized/date";
  import { Eye, User, Calendar, FileText } from "@lucide/svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { resest } from "../../../../routes/(pages)/(clients)/book-appointment/[[id]]/(components)/utils";
  import { Button } from "../button";
  import LocalizedText from "./localized-text.svelte";

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
          <div class="flex flex-col gap-1">
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
            </div>
            {#if channel.requiresConfirmation}
              <div class="flex max-w-4/5 items-start gap-2">
                <Eye class="text-muted-foreground mt-0.5 size-3 shrink-0" />
                <Text style="xs" class="text-muted-foreground font-normal">
                  {m["public.appointment.requiresConfirmation"]({ name: tenant.longName })}
                </Text>
              </div>
            {/if}
            {#if appointment.agent || appointment.agent === null}
              <div class="flex items-center gap-2">
                <User class="size-3" />
                <Text style="sm" class="font-normal">
                  {appointment.agent?.name || m["public.anyAgent"]()}
                </Text>
              </div>
            {/if}
            {#if appointment.slot}
              <div class="flex items-center gap-2">
                <Calendar class="size-3" />
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
              <div class="flex items-start gap-2">
                <FileText class="mt-1 size-3" />
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
