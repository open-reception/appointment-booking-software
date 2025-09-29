<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import { translatedLocales } from "$lib/const/locales";
  import { tenants } from "$lib/stores/tenants";
  import type { Snippet } from "svelte";
  import { Separator } from "../separator";

  const tenantLanguages = ($tenants.currentTenant?.languages || []).map((it) => ({
    key: it,
    label: translatedLocales[it as keyof typeof translatedLocales],
  }));

  type Props = {
    children: Snippet<[{ locale: string }]>;
  };

  let { children }: Props = $props();
</script>

<Tabs.Root value={tenantLanguages[0]?.key}>
  {#if tenantLanguages.length > 1}
    <Tabs.List>
      {#each tenantLanguages as language (language.key)}
        <Tabs.Trigger value={language.key}>{language.label}</Tabs.Trigger>
      {/each}
    </Tabs.List>
  {/if}
  {#each tenantLanguages as language (language.key)}
    <Tabs.Content value={language.key}>
      {@render children({ locale: language.key })}
    </Tabs.Content>
  {/each}
</Tabs.Root>
<Separator class="mb-3" />
