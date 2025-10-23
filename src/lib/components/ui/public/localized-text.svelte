<script lang="ts">
  import { publicStore } from "$lib/stores/public";
  type TranslationsObject = { [key: string]: string };

  let { translations }: { translations: TranslationsObject } = $props();

  const tenantLocale = $derived($publicStore.locale);

  const getTranslation = (): string => {
    const translation = Object.entries(translations).find(
      ([key, value]) => key === tenantLocale && value,
    );
    if (translation) {
      return translation[1] || "";
    }
    return "";
  };
</script>

{getTranslation()}
