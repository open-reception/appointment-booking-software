<script lang="ts">
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { ROUTES } from "$lib/const/routes";
  import { Card } from "$lib/components/ui/card";
  import { Headline } from "$lib/components/ui/typography";
  import { EditSettingsForm } from "./(components)/edit-settings-form";
  import { LoadingCenter } from "$lib/components/templates/loading";

  let { data } = $props();
</script>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.settings"](),
      href: ROUTES.DASHBOARD.SETTINGS,
    },
  ]}
>
  <MaxPageWidth maxWidth="lg">
    {#await data.streamed.item}
      <LoadingCenter title={m["settings.loading"]()} class="h-[80vh] py-20" />
    {:then item}
      <Card>
        <Headline style="h4" level="h1">Settings</Headline>
        <EditSettingsForm entity={item} />
      </Card>
    {/await}
  </MaxPageWidth>
</SidebarLayout>
