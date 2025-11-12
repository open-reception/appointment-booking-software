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
      label: m["account.passkeys.navItem"](),
      href: ROUTES.DASHBOARD.ACCOUNT.PASSKEYS,
    },
  ]}
>
  <MaxPageWidth maxWidth="md" class="flex flex-col gap-6">
    <Headline level="h1" style="h3">{m["account.passkeys.title"]()}</Headline>
  </MaxPageWidth>
</SidebarLayout>
