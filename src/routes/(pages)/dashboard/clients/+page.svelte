<script lang="ts">
  import { m } from "$i18n/messages";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { closeDialog, ResponsiveDialog } from "$lib/components/ui/responsive-dialog";
  import { ROUTES } from "$lib/const/routes";
  import { ResetPinForm } from "./(components)/reset-pin-form";
</script>

<svelte:head>
  <title>{m["clients.title"]()} - OpenReception</title>
</svelte:head>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.clients"](),
      href: ROUTES.DASHBOARD.CLIENTS,
    },
  ]}
>
  <MaxPageWidth maxWidth="lg">
    <div class="flex justify-end">
      <ResponsiveDialog
        id="pin-reset"
        title={m["clients.pinReset.title"]()}
        description={m["clients.pinReset.description"]()}
        triggerHidden={false}
        triggerLabel={m["clients.pinReset.title"]()}
      >
        <ResetPinForm
          done={() => {
            closeDialog("pin-reset");
          }}
        />
      </ResponsiveDialog>
    </div>
  </MaxPageWidth>
</SidebarLayout>
