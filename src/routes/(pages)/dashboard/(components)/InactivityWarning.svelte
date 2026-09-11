<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "$i18n/messages";
  import { Button } from "$lib/components/ui/button";
  import { openDialog, closeDialog, ResponsiveDialog } from "$lib/components/ui/responsive-dialog";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";

  $effect(() => {
    if ($auth.isInactive) {
      openDialog("inactivity-warning");
    } else {
      closeDialog("inactivity-warning");
    }
  });
</script>

<ResponsiveDialog
  id="inactivity-warning"
  title={m["dashboard.inactiveSession.title"]()}
  description={m["dashboard.inactiveSession.description"]()}
  triggerHidden={true}
  isDismissable={false}
>
  <div class="flex flex-col gap-2">
    <Button onclick={() => auth.refreshLastActive()} class="w-full">
      {m["dashboard.inactiveSession.cancel"]()}
    </Button>
    <Button href={resolve(ROUTES.LOGOUT)} variant="link" class="w-full">
      {m["logout.title"]()}
    </Button>
  </div>
</ResponsiveDialog>
