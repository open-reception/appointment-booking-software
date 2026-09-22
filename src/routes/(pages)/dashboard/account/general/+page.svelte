<script lang="ts">
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { PageHeadline } from "$lib/components/templates/page-headline";
  import { ROUTES } from "$lib/const/routes";
  import { AccountSettingsForm } from "./(components)/account-settings-form";
</script>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.account"](),
      href: ROUTES.DASHBOARD.ACCOUNT.MAIN,
    },
    {
      label: m["account.general.navItem"](),
      href: ROUTES.DASHBOARD.ACCOUNT.GENERAL,
    },
  ]}
>
  <MaxPageWidth maxWidth="md" class="flex flex-col gap-6">
    <PageHeadline title={m["account.general.title"]()} backHref={ROUTES.DASHBOARD.ACCOUNT.MAIN} />
    <AccountSettingsForm />
  </MaxPageWidth>
</SidebarLayout>
