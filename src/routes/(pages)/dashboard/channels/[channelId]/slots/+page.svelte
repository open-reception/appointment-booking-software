<script lang="ts">
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { LoadingDetail } from "$lib/components/templates/loading";
  import { PageHeadline } from "$lib/components/templates/page-headline";
  import { getChannelRoute, ROUTES } from "$lib/const/routes";
  import { type TChannelWithFullAgents } from "$lib/types/channel";
  import { getCurrentTranslation } from "$lib/utils/localizations";
  import ChannelNotFound from "../(components)/channel-not-found.svelte";
  import { EditChannelFormSlots } from "../../(components)/edit-channel-form";

  let { data } = $props();

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
    {
      label: m["channels.edit.slotTemplates.title"](),
      href: getChannelRoute(ROUTES.DASHBOARD.CHANNEL_SLOTS, channel?.id || ""),
    },
  ]}
>
  <MaxPageWidth maxWidth="lg" class="flex flex-col gap-6">
    {#await data.streamed.channel}
      <LoadingDetail title={m["channels.loadingDetail"]()} />
    {:then channel}
      {#if channel}
        <PageHeadline
          title={`${m["channels.edit.title"]()}: ${m["channels.edit.slotTemplates.title"]()}`}
          description={getCurrentTranslation(channel?.names ?? {})}
          backHref={getChannelRoute(ROUTES.DASHBOARD.CHANNEL, channel?.id || "")}
        />
        <EditChannelFormSlots entity={channel} />
      {:else}
        <ChannelNotFound />
      {/if}
    {/await}
  </MaxPageWidth>
</SidebarLayout>
