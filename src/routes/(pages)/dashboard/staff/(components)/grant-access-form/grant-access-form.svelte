<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { CenterLoadingState, CenterState } from "$lib/components/templates/empty-state";
  import { Button } from "$lib/components/ui/button";
  import { InlineCode } from "$lib/components/ui/inline-code";
  import { TranslationWithComponent } from "$lib/components/ui/translation-with-component";
  import { Text } from "$lib/components/ui/typography";
  import type { ClientTunnelResponse } from "$lib/server/services/appointment-service";
  import { auth } from "$lib/stores/auth";
  import type { TStaff } from "$lib/types/users";
  import StopIcon from "@lucide/svelte/icons/octagon-x";
  import { toast } from "svelte-sonner";
  import { addStaffKeyShares, fetchClientTunnels } from "../utils";
  import { Check, TriangleAlert } from "@lucide/svelte";
  import { staffCrypto } from "$lib/stores/staff-crypto";

  let { entity, done }: { entity: TStaff; done: () => void } = $props();
  const myUserRole = $derived($auth.user?.role);
  const tenantId = $derived($auth.user?.tenantId);
  let step: "init" | "fetch-tunnels" | "add-staff-key-shares" | "success" | "error" =
    $state("init");
  let isSubmitting = $state(false);
  let tunnels: ClientTunnelResponse[] = $state([]);

  const grantAccess = async () => {
    if (!tenantId || !$staffCrypto.crypto) return;
    const cryptoClient = $staffCrypto.crypto;

    isSubmitting = true;
    step = "fetch-tunnels";

    try {
      // Fetching all tunnels
      tunnels = await fetchClientTunnels(tenantId);
      step = "add-staff-key-shares";

      // For each tunnel: decrypt currentStaffEncryptedTunnelKey with current user private key
      const allPublicKeys = await cryptoClient.fetchStaffPublicKeys(tenantId);
      const newUserPublicKeys = allPublicKeys.filter((x) => x.userId === entity.id);

      if (newUserPublicKeys.length === 0) {
        throw new Error("No public key found for target staff member");
      }

      const keyShares = await Promise.all(
        tunnels.map(async (tunnel) => {
          if (!tunnel.currentStaffEncryptedTunnelKey) {
            throw new Error(`Missing current staff key share for tunnel ${tunnel.id}`);
          }

          const decryptedTunnelKey = await cryptoClient.decryptTunnelKeyByStaff(
            tunnel.currentStaffEncryptedTunnelKey,
          );

          const encryptedForNewStaff = await cryptoClient.encryptTunnelKeyForStaff(
            newUserPublicKeys,
            decryptedTunnelKey,
          );

          if (encryptedForNewStaff.length === 0) {
            throw new Error(`Failed to encrypt tunnel key for new staff on tunnel ${tunnel.id}`);
          }

          return {
            tunnelId: tunnel.id,
            encryptedTunnelKey: encryptedForNewStaff[0].encryptedTunnelKey,
          };
        }),
      );
      console.log("keyShares", keyShares);

      // Setting staff key shares
      const isOk = await addStaffKeyShares(tenantId, entity.id, keyShares);
      if (isOk) {
        step = "success";
        isSubmitting = false;
        toast.success(m["staff.access.success.title"]());
        done();
      } else {
        step = "error";
        toast.error(m["staff.access.error.title"]());
        isSubmitting = false;
      }
    } catch (error) {
      console.error(error);
      step = "error";
      toast.error(m["staff.access.error.title"]());
      isSubmitting = false;
    }
  };
</script>

<div class="flex flex-col gap-3">
  <Text style="sm" class="text-muted-foreground -mt-2 font-normal">
    <TranslationWithComponent
      translation={m["staff.access.description"]({ name: "{name}" })}
      interpolations={[{ param: "{name}", value: entity.name, snippet: inlineCode }]}
    />
  </Text>
  {#if myUserRole === "GLOBAL_ADMIN"}
    <CenterState
      headline={m["staff.access.unavailable.title"]()}
      description={m["staff.access.unavailable.description"]()}
      Icon={StopIcon}
      size="sm"
    />
  {:else if step === "init"}
    <Button
      size="lg"
      type="button"
      onclick={grantAccess}
      isLoading={isSubmitting}
      disabled={isSubmitting}
    >
      {m["staff.access.action"]()}
    </Button>
  {:else if step === "fetch-tunnels"}
    <CenterLoadingState label={m["staff.access.loadingTunnels"]()} />
  {:else if step === "add-staff-key-shares"}
    <CenterLoadingState label={m["staff.access.loadingAddingKeyShares"]()} />
  {:else if step === "success"}
    <CenterState
      headline={m["staff.access.success.title"]()}
      description={m["staff.access.success.description"]({ name: entity.name })}
      Icon={Check}
      size="sm"
    />
  {:else if step === "error"}
    <CenterState
      headline={m["staff.access.error.title"]()}
      description={m["staff.access.error.description"]()}
      Icon={TriangleAlert}
      size="sm"
    />
  {/if}
</div>

{#snippet inlineCode(value: string | number)}
  <InlineCode>{value}</InlineCode>
{/snippet}
