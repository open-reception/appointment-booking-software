<script lang="ts">
  import { m } from "$i18n/messages";
  import { setLocale, type Locale } from "$i18n/runtime";
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
    <Button href={ROUTES.LOGIN} size="sm" variant="link">{m["login.action"]()}</Button>
  {/snippet}
  {@render children()}
  {#snippet footer()}
    {#await data.streaming.tenant then tenant}
      <div class="text-muted-foreground flex justify-center gap-2">
        {#if tenant?.links.imprint}
          <Button href={tenant?.links.imprint} size="xs" variant="link" class="text-inherit">
            {m["public.links.imprint"]()}
          </Button>
        {/if}
        {#if tenant?.links.privacyStatement}
          <Button
            href={tenant?.links.privacyStatement}
            size="xs"
            variant="link"
            class="text-inherit"
          >
            {m["public.links.privacyStatement"]()}
          </Button>
        {/if}
      </div>
    {/await}
  {/snippet}
</PageWithClaim>
