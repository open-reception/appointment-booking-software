<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { m } from "$i18n/messages.js";
  import { MaxPageWidth } from "$lib/components/layouts/max-page-width";
  import { Button } from "$lib/components/ui/button";
  import { HorizontalPagePadding } from "$lib/components/ui/page";
  import { Separator } from "$lib/components/ui/separator";
  import AppointmentList from "./(components)/appointment-list.svelte";
  import { Headline } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { publicStore } from "$lib/stores/public";

  const logout = () => {
    $publicStore.crypto?.logoutClient();
    goto(resolve(ROUTES.MAIN));
  };
</script>

<svelte:head>
  <title>{m["clients.title"]()} - OpenReception</title>
</svelte:head>

<HorizontalPagePadding>
  <MaxPageWidth maxWidth="lg" class="mt-10 grid gap-y-5">
    <div class="flex flex-col gap-2">
      <div class="flex items-end justify-between gap-3">
        <Headline level="h1" style="h1">{m["dashboard.hello"]()} 👋</Headline>
        <Button size="sm" variant="outline" onclick={logout}>{m["nav.logout"]()}</Button>
      </div>
      <Separator />
    </div>
    <AppointmentList />
  </MaxPageWidth>
</HorizontalPagePadding>
