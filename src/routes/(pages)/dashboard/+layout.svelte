<script lang="ts">
  import { refreshSession } from "$lib/utils/session";
  import { onMount } from "svelte";
  import type { LayoutProps } from "./$types";
  import { auth } from "$lib/stores/auth";
  import { tenants } from "$lib/stores/tenants";
  import { staffCrypto } from "$lib/stores/staff-crypto";

  let { data, children }: LayoutProps = $props();

  let intervalId: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    if (data?.user) {
      auth.setUser(data.user);
    }

    initTenants();
    initStaffCrypto();

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
        tenants.setCurrentTenant($auth.user.tenantId);
      }
    }
  };

  const initStaffCrypto = async () => {
    if (data?.user?.id && data?.user?.tenantId && data?.user.role !== "GLOBAL_ADMIN") {
      // Try to initialize from session storage (from login)
      const success = await staffCrypto.initFromSession(data.user.id, data.user.tenantId);
      if (success) {
        console.log("✅ Staff crypto initialized successfully");
      } else {
        console.log("ℹ️ Staff crypto not initialized (no session data or error)");
      }
    }
  };
</script>

{@render children()}
