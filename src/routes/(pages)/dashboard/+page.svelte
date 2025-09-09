<script lang="ts">
  import { goto } from "$app/navigation";
  import { m } from "$i18n/messages";
  import { SidebarLayout } from "$lib/components/layouts/sidebar-layout";
  import { Button } from "$lib/components/ui/button";
  import { InlineCode } from "$lib/components/ui/inline-code";
  import { OnboardingGuide } from "$lib/components/ui/onboarding-guide";
  import TranslationWithComponent from "$lib/components/ui/translation-with-component/translation-with-component.svelte";
  import { Headline, Text } from "$lib/components/ui/typography";
  import { ROUTES } from "$lib/const/routes";
  import { auth } from "$lib/stores/auth";
  import { sidebar } from "$lib/stores/sidebar";
  import { tenants } from "$lib/stores/tenants";
  import MenuPositionIcon from "@lucide/svelte/icons/corner-left-up";
  import CloseIcon from "@lucide/svelte/icons/x";
</script>

<SidebarLayout
  breakcrumbs={[
    {
      label: m["nav.home"](),
      href: ROUTES.DASHBOARD.MAIN,
    },
  ]}
>
  <div class="flex flex-col gap-4">
    {#if !$sidebar.isEducated}
      <div
        class="bg-muted -mt-4 mb-4 -ml-1 flex w-auto items-center gap-3 self-start rounded-md p-2"
      >
        <MenuPositionIcon class="size-4" />
        <Text style="sm">
          {m["dashboard.sidebar.title"]()}<br />
          <span class="font-normal">
            <TranslationWithComponent
              translation={m["dashboard.sidebar.description"]({ name: "{name}" })}
              interpolations={[{ param: "{name}", value: m["nav.toggleSidebar"]() }]}
            />
          </span>
        </Text>
        <Button
          variant="ghost"
          size="xs"
          class="cursor-pointer !px-0 pt-0.25"
          onclick={() => sidebar.setEducated(true, true)}
        >
          <CloseIcon />
          <span class="sr-only">{m.close()}</span>
        </Button>
      </div>
    {/if}
    <Headline level="h1" style="h2">{m["dashboard.hello"]()} 👋</Headline>
    {#if $auth.user?.role === "GLOBAL_ADMIN"}
      {#if $tenants.tenants.length === 0}
        <OnboardingGuide
          title={m["dashboard.tenants.setup.title"]()}
          steps={[
            {
              title: m["dashboard.tenants.setup.sections.tenants.title"](),
              description: m["dashboard.tenants.setup.sections.tenants.description"](),
              actions: [
                {
                  label: m["dashboard.tenants.setup.sections.tenants.action"](),
                  onClick: (e: MouseEvent) => {
                    e.preventDefault();
                    goto(ROUTES.DASHBOARD.TENANTS, { state: { action: "add" } });
                  },
                  href: ROUTES.DASHBOARD.TENANTS,
                },
              ],
              isDone: false,
            },
          ]}
        />
      {:else if $tenants.currentTenant}
        <Text style="md">
          <TranslationWithComponent
            translation={m["dashboard.tenants.currentTenant"]({ name: "{name}" })}
            interpolations={[
              { param: "{name}", value: $tenants.currentTenant.shortName, snippet: inlineCode },
            ]}
          />
        </Text>
      {/if}
    {/if}
  </div>
</SidebarLayout>

{#snippet inlineCode(value: string | number)}
  <InlineCode>{value}</InlineCode>
{/snippet}
