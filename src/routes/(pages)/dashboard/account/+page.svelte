<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { PageHeadline } from "$lib/components/templates/page-headline";
  import { GroupItem } from "$lib/components/ui/group-item";
  import * as Item from "$lib/components/ui/item";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
</script>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.account"](),
      href: ROUTES.DASHBOARD.ACCOUNT.MAIN,
    },
  ]}
>
  <MaxPageWidth maxWidth="md" class="flex flex-col gap-6">
    <PageHeadline title={m["account.overview.title"]()} />
    <Item.Group class="gap-2">
      <GroupItem
        title={m["account.general.title"]()}
        description={m["account.general.description"]()}
        href={resolve(ROUTES.DASHBOARD.ACCOUNT.GENERAL)}
      />
      <!-- <GroupItem
        title={m["account.change-email.title"]()}
        description={m["account.change-email.description"]()}
        href={resolve(ROUTES.DASHBOARD.ACCOUNT.CHANGE_EMAIL)}
      /> -->
      <GroupItem
        title={m["account.passkeys.title"]()}
        description={m["account.passkeys.description"]()}
        href={resolve(ROUTES.DASHBOARD.ACCOUNT.PASSKEYS)}
      />
      {#if $auth.user?.role === "GLOBAL_ADMIN"}
        <GroupItem
          title={m["account.change-passphrase.title"]()}
          description={m["account.change-passphrase.description"]()}
          href={resolve(ROUTES.DASHBOARD.ACCOUNT.CHANGE_PASSPHRASE)}
        />
      {/if}
    </Item.Group>
  </MaxPageWidth>
</SidebarLayout>
