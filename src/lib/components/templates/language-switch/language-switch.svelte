<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { getLocale, setLocale } from "$i18n/runtime.js";
  import type { ButtonSize, ButtonVariant } from "$lib/components/ui/button";
  import { ComboBox } from "$lib/components/ui/combobox";
  import { languageSwitchLocales, supportedLocales } from "$lib/const/locales";
  import { cn } from "$lib/utils";

  let {
    locales,
    class: className = "",
    triggerClass = "",
    triggerSize = "default",
    triggerVariant = "ghost",
  }: {
    locales?: (typeof supportedLocales)[];
    triggerVariant?: ButtonVariant;
    triggerSize?: ButtonSize;
    class?: string;
    triggerClass?: string;
  } = $props();

  const options = $derived(
    locales
      ? Object.values(languageSwitchLocales).filter((it) =>
          locales.includes(it.value as unknown as typeof supportedLocales),
        )
      : Object.values(languageSwitchLocales),
  );
</script>

{#if options.length > 1}
  <div class={className}>
    <ComboBox
      {options}
      value={getLocale()}
      onChange={(value) => {
        setLocale(value as "de" | "en");
      }}
      labels={{
        placeholder: m["i18n.label"](),
        search: m["i18n.search"](),
        notFound: m["i18n.notFound"](),
      }}
      {triggerVariant}
      {triggerSize}
      {triggerClass}
      class={cn("w-auto")}
    />
  </div>
{/if}
