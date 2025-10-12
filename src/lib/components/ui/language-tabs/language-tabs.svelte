<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import { translatedLocales } from "$lib/const/locales";
  import { tenants } from "$lib/stores/tenants";
  import type { Snippet } from "svelte";
  import { Separator } from "../separator";

  type Props = {
    languages?: string[];
    children: Snippet<[{ locale: string }]>;
  };

  let { languages, children }: Props = $props();

  let tenantLanguages = $derived(
    (languages ? languages : $tenants.currentTenant?.languages || []).map((it) => ({
      key: it,
      label: translatedLocales[it as keyof typeof translatedLocales],
    })),
  );
</script>

{#if tenantLanguages.length > 1}
  <Tabs.Root value={tenantLanguages[0]?.key}>
    <Tabs.List>
      {#each tenantLanguages as language (language.key)}
        <Tabs.Trigger value={language.key}>{language.label}</Tabs.Trigger>
      {/each}
    </Tabs.List>
    {#each tenantLanguages as language (language.key)}
      <Tabs.Content value={language.key}>
        {@render children({ locale: language.key })}
      </Tabs.Content>
    {/each}
  </Tabs.Root>
  <Separator class="mb-3" />
{:else if tenantLanguages.length === 1}
  {@render children({ locale: tenantLanguages[0].key })}
{/if}
