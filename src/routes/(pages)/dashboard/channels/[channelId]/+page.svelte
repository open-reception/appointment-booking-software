<script lang="ts">
  import { invalidate } from "$app/navigation";
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { LoadingItemGroup } from "$lib/components/templates/loading";
  import { PageHeadline } from "$lib/components/templates/page-headline";
  import { GroupItem } from "$lib/components/ui/group-item";
  import * as Item from "$lib/components/ui/item";
  import { closeDialog, openDialog, ResponsiveDialog } from "$lib/components/ui/responsive-dialog";
  import { getChannelRoute, ROUTES } from "$lib/const/routes";
  import { channels } from "$lib/stores/channels";
  import { tenants } from "$lib/stores/tenants";
  import { type TChannelWithFullAgents } from "$lib/types/channel";
  import { getCurrentTranslation } from "$lib/utils/localizations";
  import { Pause, Play, SquarePen } from "@lucide/svelte";
  import {
    EditChannelFormAgents,
    EditChannelFormBasics,
    EditChannelFormNotifications,
  } from "../(components)/edit-channel-form";
  import { PauseChannelForm } from "../(components)/pause-channel-form";
  import ChannelNotFound from "./(components)/channel-not-found.svelte";

  const { data } = $props();
  let channel: TChannelWithFullAgents | undefined = $state(undefined);

  $effect(() => {
    data.streamed.channel.then((c: TChannelWithFullAgents | undefined) => {
      channel = c;
    });
  });
</script>

<svelte:head>
  <title>{m["channels.title"]()} - OpenReception</title>
</svelte:head>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.channels"](),
      href: ROUTES.DASHBOARD.CHANNELS,
    },
    {
      label: channel ? getCurrentTranslation(channel?.names ?? {}) : "...",
      href: getChannelRoute(ROUTES.DASHBOARD.CHANNEL, channel?.id || ""),
    },
  ]}
>
  <MaxPageWidth maxWidth="lg" class="flex flex-col gap-6">
    {#await data.streamed.channel}
      <LoadingItemGroup title={m["channels.loadingDetail"]()} />
    {:then channel}
      {#if channel}
        <PageHeadline
          title={m["channels.edit.title"]()}
          description={getCurrentTranslation(channel?.names ?? {})}
          backHref={ROUTES.DASHBOARD.CHANNELS}
        >
          {#snippet actions()}
            {#if channel}
              <ResponsiveDialog
                id="pause"
                title={channel.pause ? m["channels.unpause.title"]() : m["channels.pause.title"]()}
                triggerVariant="outline"
                triggerSize="sm"
              >
                {#snippet triggerLabel()}
                  {#if channel}
                    <div class="flex items-center gap-2">
                      {#if channel.pause}
                        <Play class="size-4" />
                      {:else}
                        <Pause class="size-4" />
                      {/if}
                      {channel.pause ? m["channels.unpause.title"]() : m["channels.pause.title"]()}
                    </div>
                  {/if}
                {/snippet}
                <PauseChannelForm
                  entity={channel}
                  done={() => {
                    tenants.reload();
                    channels.load();
                    invalidate(`channel:details`);
                    closeDialog("pause");
                  }}
                />
              </ResponsiveDialog>
            {/if}
          {/snippet}
        </PageHeadline>
        <Item.Group class="gap-2">
          <GroupItem
            title={m["channels.edit.basics.title"]()}
            description={m["channels.edit.basics.description"]()}
            Icon={SquarePen}
            onclick={() => {
              openDialog("basics");
            }}
          />
          <GroupItem
            title={m["channels.edit.agents.title"]()}
            description={m["channels.edit.agents.description"]()}
            Icon={SquarePen}
            badges={channel.agents.length === 0
              ? [{ variant: "destructive", label: m["required"]() }]
              : undefined}
            onclick={() => {
              openDialog("agents");
            }}
          />
          <GroupItem
            title={m["channels.edit.slotTemplates.title"]()}
            description={m["channels.edit.slotTemplates.description"]()}
            badges={channel.slotTemplates.length === 0
              ? [{ variant: "destructive", label: m["required"]() }]
              : undefined}
            href={getChannelRoute(ROUTES.DASHBOARD.CHANNEL_SLOTS, channel?.id)}
          />
          <GroupItem
            title={m["channels.edit.publicBooking.title"]()}
            description={m["channels.edit.publicBooking.description"]()}
            Icon={SquarePen}
            href={getChannelRoute(ROUTES.DASHBOARD.CHANNEL_PUBLIC_BOOKING, channel?.id)}
          />
          <GroupItem
            title={m["channels.edit.notifications.title"]()}
            description={m["channels.edit.notifications.description"]()}
            Icon={SquarePen}
            onclick={() => {
              openDialog("notifications");
            }}
          />
        </Item.Group>
      {:else}
        <ChannelNotFound />
      {/if}
    {/await}
  </MaxPageWidth>
</SidebarLayout>

<ResponsiveDialog
  id="basics"
  title={m["channels.edit.basics.title"]()}
  description={m["channels.edit.basics.description"]()}
  triggerHidden={true}
>
  {#if channel}
    <EditChannelFormBasics
      entity={channel}
      done={() => {
        closeDialog("basics");
        invalidate(`channel:details`);
        channels.load();
      }}
    />
  {/if}
</ResponsiveDialog>

<ResponsiveDialog
  id="agents"
  title={m["channels.edit.agents.title"]()}
  description={m["channels.edit.agents.description"]()}
  triggerHidden={true}
>
  {#if channel}
    <EditChannelFormAgents
      entity={channel}
      done={() => {
        tenants.reload();
        channels.load();
        closeDialog("agents");
        invalidate(`channel:details`);
        channels.load();
      }}
    />
  {/if}
</ResponsiveDialog>

<ResponsiveDialog
  id="notifications"
  title={m["channels.edit.notifications.title"]()}
  description={m["channels.edit.notifications.description"]()}
  triggerHidden={true}
>
  {#if channel}
    <EditChannelFormNotifications
      entity={channel}
      done={() => {
        closeDialog("notifications");
        invalidate(`channel:details`);
        channels.load();
      }}
    />
  {/if}
</ResponsiveDialog>
