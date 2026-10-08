<script lang="ts">
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { LoadingDetail } from "$lib/components/templates/loading";
  import { PageHeadline } from "$lib/components/templates/page-headline";
  import { ROUTES } from "$lib/const/routes";
  import { EditSettingsFormAddress } from "../(components)/edit-settings-form";

  let { data } = $props();
</script>

<svelte:head>
  <title>{m["settings.title"]()}: {m["settings.address.title"]()} - OpenReception</title>
</svelte:head>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.settings"](),
      href: ROUTES.DASHBOARD.SETTINGS.MAIN,
    },
    {
      label: m["settings.address.title"](),
      href: ROUTES.DASHBOARD.SETTINGS.ADDRESS,
    },
  ]}
>
  <MaxPageWidth maxWidth="lg" class="flex flex-col gap-6">
    {#await data.streamed.item}
      <LoadingDetail title={m["settings.loading"]()} />
    {:then item}
      {#if item}
        <PageHeadline
          title={m["settings.address.title"]()}
          description={m["settings.address.description"]()}
          backHref={ROUTES.DASHBOARD.SETTINGS.MAIN}
        />
        <EditSettingsFormAddress entity={item} />
      {/if}
    {/await}
  </MaxPageWidth>
</SidebarLayout>
