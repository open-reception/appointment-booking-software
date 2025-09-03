<script lang="ts">
  import { refreshSession, refreshUserData } from "$lib/utils/session";
  import { onMount } from "svelte";
  import type { LayoutProps } from "./$types";
  import { auth } from "$lib/stores/auth";

  let { data, children }: LayoutProps = $props();

  let intervalId: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    if (data?.user) {
      auth.setUser(data.user);
    }

    const unsubscribe = () => {
      if (!intervalId) {
        refreshSession();
        intervalId = setInterval(refreshSession, 10 * 60 * 1000); // 10 minutes
      }
    };

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        refreshSession();
      }
    };
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleFocus);
    };
  });
</script>

{@render children()}
