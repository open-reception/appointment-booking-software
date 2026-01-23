<script lang="ts">
  import { browser } from "$app/environment";
  import { setLocale } from "$i18n/runtime";
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { ModeWatcher, setMode } from "mode-watcher";
  import "../app.css";

  let { data, children } = $props();

  $effect(() => {
    if (!browser) return;

    if (data.locale) {
      setLocale(data.locale);
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const newMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      setMode(newMode);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  });
</script>

<ModeWatcher track={false} />
<Toaster richColors />
<Tooltip.Provider delayDuration={0}>
  {@render children()}
</Tooltip.Provider>
