<script module lang="ts">
  declare const __APP_VERSION__: string;
</script>

<script lang="ts">
  import { dev } from "$app/environment";
  import { m } from "$i18n/messages";
  import { cn, type WithElementRef } from "$lib/utils";
  import { toggleMode, mode } from "mode-watcher";
  import type { HTMLAttributes } from "svelte/elements";
  import { Text } from "../typography";
  import HorizontalPagePadding from "./horizontal-page-padding.svelte";
  import { LanguageSwitch } from "$lib/components/templates/language-switch";
  import type { Snippet } from "svelte";
  import type { supportedLocales } from "$lib/const/locales";

  let {
    ref = $bindable(null),
    class: className,
    children,
    left,
    footer,
    languages,
    isWithLanguageSwitch = false,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    left?: Snippet;
    footer?: Snippet;
    languages?: (typeof supportedLocales)[];
    isWithLanguageSwitch?: boolean;
  } = $props();
</script>

<div bind:this={ref} class={cn("flex min-h-dvh flex-col", className)} {...restProps}>
  {#if isWithLanguageSwitch}
    <HorizontalPagePadding class="flex pt-4">
      {#if left}
        {@render left()}
      {/if}
      <LanguageSwitch class="ml-auto" triggerSize="sm" locales={languages} />
    </HorizontalPagePadding>
  {/if}
  {@render children?.()}

  <HorizontalPagePadding
    as="footer"
    class="bg-muted text-muted-foreground mt-auto flex items-center justify-between py-2"
  >
    {#if dev}
      <Text style="xs" class="flex gap-1">
        Viewport:
        <div class="sm:hidden">xs</div>
        <div class="hidden sm:block md:hidden">sm</div>
        <div class="hidden md:block lg:hidden">md</div>
        <div class="hidden lg:block xl:hidden">lg</div>
        <div class="hidden xl:block 2xl:hidden">xl</div>
        <div class="hidden 2xl:block">2xl</div>
      </Text>
    {/if}
    <div class="mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      {#if footer}
        {@render footer()}
      {/if}
      <Text style="xs" title={`v${__APP_VERSION__}`}>
        {m.poweredBy()}
        <a href="https://open-reception.org" target="_blank" class="underline"> OpenReception </a>
      </Text>
    </div>
    {#if dev}
      <button onclick={toggleMode} class="cursor-pointer text-xs">
        {mode?.current === "dark" ? "dark" : "light"}Mode
      </button>
    {/if}
  </HorizontalPagePadding>
</div>
