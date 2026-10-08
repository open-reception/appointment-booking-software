<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { LoadingItemGroup } from "$lib/components/templates/loading/index.js";
  import { PageHeadline } from "$lib/components/templates/page-headline";
  import { GroupItem } from "$lib/components/ui/group-item";
  import * as Item from "$lib/components/ui/item";
  import { ROUTES } from "$lib/const/routes";
  import type { TTenantSettings } from "$lib/types/tenant";

  let { data } = $props();

  const isAddressComplete = (address: TTenantSettings["address"]) => {
    return (
      address &&
      address.street !== "" &&
      address.number !== "" &&
      address.zip !== "" &&
      address.city !== ""
    );
  };
</script>

<svelte:head>
  <title>{m["settings.title"]()} - OpenReception</title>
</svelte:head>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.settings"](),
      href: ROUTES.DASHBOARD.SETTINGS.MAIN,
    },
  ]}
>
  <MaxPageWidth maxWidth="lg" class="flex flex-col gap-6">
    {#await data.streamed.item}
      <LoadingItemGroup title={m["settings.loading"]()} />
    {:then item}
      {#if item}
        <PageHeadline title={m["settings.overview.title"]()} />
        <Item.Group class="gap-2">
          <GroupItem
            title={m["settings.general.title"]()}
            description={m["settings.general.description"]()}
            badges={item.longName === ""
              ? [{ variant: "destructive", label: m["required"]() }]
              : undefined}
            href={resolve(ROUTES.DASHBOARD.SETTINGS.GENERAL)}
          />
          <GroupItem
            title={m["settings.address.title"]()}
            description={m["settings.address.description"]()}
            badges={!isAddressComplete(item.address)
              ? [{ variant: "destructive", label: m["required"]() }]
              : undefined}
            href={resolve(ROUTES.DASHBOARD.SETTINGS.ADDRESS)}
          />
          <GroupItem
            title={m["settings.links.title"]()}
            description={m["settings.links.description"]()}
            href={resolve(ROUTES.DASHBOARD.SETTINGS.LINKS)}
          />
          <GroupItem
            title={m["settings.advanced.title"]()}
            description={m["settings.advanced.description"]()}
            href={resolve(ROUTES.DASHBOARD.SETTINGS.ADVANCED)}
          />
        </Item.Group>
      {/if}
    {/await}
  </MaxPageWidth>
</SidebarLayout>
