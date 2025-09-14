<script lang="ts">
  import { refreshSession } from "$lib/utils/session";
  import { onMount } from "svelte";
  import type { LayoutProps } from "./$types";
  import { auth } from "$lib/stores/auth";
  import { tenants } from "$lib/stores/tenants";

  let { data, children }: LayoutProps = $props();

  let intervalId: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    if (data?.user) {
      auth.setUser(data.user);
    }

    initTenants();

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

  const initTenants = async () => {
    if (data?.tenants) {
      tenants.init(await data.tenants);
      if ($auth.user?.tenantId) {
        tenants.setCurrentTenant($auth.user.tenantId, false);
      }
    }
  };
</script>

{@render children()}
