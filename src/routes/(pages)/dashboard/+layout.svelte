<script lang="ts">
  import { refreshSession } from "$lib/utils/session";
  import { onMount } from "svelte";
  import type { LayoutProps } from "./$types";
  import { auth } from "$lib/stores/auth";
  import { tenants } from "$lib/stores/tenants";
  import { staffCrypto } from "$lib/stores/staff-crypto";
  import { notifications } from "$lib/stores/notifications";
  import { staff } from "$lib/stores/staff";

  let { data, children }: LayoutProps = $props();

  let intervalSession: ReturnType<typeof setInterval> | null = null;
  let intervalData: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    if (data?.user) {
      auth.setUser(data.user);
    }

    initTenants();
    initStaffCrypto();
    updateStores();

    if (!intervalData) {
      refreshSession();
      intervalData = setInterval(updateStores, 2 * 60 * 1000); // 2 minutes
    }
    if (!intervalSession) {
      refreshSession();
      intervalSession = setInterval(refreshSession, 10 * 60 * 1000); // 10 minutes
    }

    const unsubscribe = () => {
      if (intervalData) clearInterval(intervalData);
      if (intervalSession) clearInterval(intervalSession);
    };

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        updateStores();
        refreshSession();
      }
    };
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleFocus);
    };
  });

  const updateStores = async () => {
    staff.load();
    notifications.load();
  };

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
