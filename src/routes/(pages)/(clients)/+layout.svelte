<script lang="ts">
  import { page } from "$app/state";
  import { m } from "$i18n/messages";
  import { setLocale, type Locale } from "$i18n/runtime";
  import PublicFooter from "$lib/components/templates/public-footer/public-footer.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import { PageWithClaim } from "$lib/components/ui/page";
  import { ROUTES } from "$lib/const/routes.js";
  import { publicStore } from "$lib/stores/public";
  import { getPublicLocale } from "$lib/utils/localizations";
  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();
  const tenant = $derived($publicStore.tenant);

  $effect(() => {
    init();
  });

  const init = async () => {
    const tenant = await data.streaming.tenant;
    if (tenant) {
      const locale = getPublicLocale(tenant);
      setLocale(locale as Locale);
      publicStore.set({
        tenant,
        isLoading: false,
        locale,
        newAppointment: { step: "SELECT_CHANNEL" },
      });
    }

    const channels = await data.streaming.channels;
    publicStore.update((state) => ({
      ...state,
      channels,
    }));
  };
</script>

<PageWithClaim isWithLanguageSwitch={true} languages={tenant?.languages}>
  {#snippet left()}
    {#if page.route.id?.includes(ROUTES.CLIENTS.MAIN)}
      <Button href={ROUTES.MAIN} size="sm" variant="link">{m["home"]()}</Button>
    {:else}
      <Button href={ROUTES.CLIENTS.LOGIN} size="sm" variant="link">{m["login.action"]()}</Button>
    {/if}
  {/snippet}
  {@render children()}
  {#snippet footer()}
    {#await data.streaming.tenant then tenant}
      {#if tenant}
        <PublicFooter {tenant} />
      {/if}
    {/await}
  {/snippet}
</PageWithClaim>
