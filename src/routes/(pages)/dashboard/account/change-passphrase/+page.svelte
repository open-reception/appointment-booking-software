<script lang="ts">
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { Headline } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
</script>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.account"](),
      href: ROUTES.DASHBOARD.ACCOUNT.MAIN,
    },
    {
      label: m["account.change-passphrase.navItem"](),
      href: ROUTES.DASHBOARD.ACCOUNT.CHANGE_PASSPHRASE,
    },
  ]}
>
  <MaxPageWidth maxWidth="md" class="flex flex-col gap-6">
    <Headline level="h1" style="h3">{m["account.change-passphrase.title"]()}</Headline>
  </MaxPageWidth>
</SidebarLayout>
