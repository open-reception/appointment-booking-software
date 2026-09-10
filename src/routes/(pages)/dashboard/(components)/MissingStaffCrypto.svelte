<script lang="ts">
  import { m } from "$i18n/messages";
  import { Button } from "$lib/components/ui/button";
  import { Passkey } from "$lib/components/ui/passkey";
  import type { PasskeyState } from "$lib/components/ui/passkey/state.svelte";
  import { closeDialog, ResponsiveDialog } from "$lib/components/ui/responsive-dialog";
  import logger from "$lib/logger";
  import { auth } from "$lib/stores/auth";
  import { staffCrypto } from "$lib/stores/staff-crypto";
  import { arrayBufferToBase64, fetchChallenge, getCredential } from "$lib/utils/passkey";
  import { toast } from "svelte-sonner";
  import type { Writable } from "svelte/store";
  import { writable } from "svelte/store";

  const passkeyLoading: Writable<PasskeyState> = writable("initial");
  const onSetPasskey = async () => {
    $passkeyLoading = "loading";

    if (!$auth.user?.email || !$auth.user.tenantId) {
      $passkeyLoading = "error";
      return;
    }

    const challenge = await fetchChallenge($auth.user.email);

    if (!challenge) {
      $passkeyLoading = "error";
      logger.error("Failed to fetch challenge", { email: $auth.user.email });
    } else {
      $passkeyLoading = "user";

      // Call WebAuthn with PRF enabled (uses email as salt for multi-passkey support)
      const credentialResp = await getCredential({
        ...challenge,
        email: $auth.user.email,
        enablePRF: true,
      }).catch((error) => {
        $passkeyLoading = "error";
        logger.error("Failed to get credential", { ...challenge, error });
      });

      if (!credentialResp) {
        $passkeyLoading = "error";
        logger.error("Credential response is falsy");
        return;
      }

      // Update form data with passkey info
      const authenticatorDataBase64 = arrayBufferToBase64(
        // @ts-expect-error response type needs to be fixed
        credentialResp.response.authenticatorData,
      );

      // Store authenticatorData and PRF output for later key reconstruction
      const passkeyId = credentialResp.id;

      // Extract PRF output from WebAuthn response (if PRF was enabled)
      let prfOutputBase64: string | undefined;
      if (credentialResp.prfOutput) {
        prfOutputBase64 = arrayBufferToBase64(credentialResp.prfOutput);
        logger.info("PRF output retrieved from login", {
          prfOutputLength: credentialResp.prfOutput.byteLength,
        });
      } else {
        logger.warn("No PRF output in login response - crypto features may not work", {
          email: $auth.user.email,
        });
      }

      auth.setPasskeyAuthData({
        authenticatorData: authenticatorDataBase64,
        passkeyId,
        email: $auth.user.email,
        prfOutput: prfOutputBase64,
      });

      await staffCrypto.authenticate($auth.user.id, $auth.user.tenantId);

      // Update UI to show passkey is ready
      $passkeyLoading = "success";
      closeDialog("missing-staff-crypto");
      toast.success(m["dashboard.missingCryptoKeys.success"]());
    }
  };
</script>

<ResponsiveDialog
  id="missing-staff-crypto"
  title={m["dashboard.missingCryptoKeys.title"]()}
  description={m["dashboard.missingCryptoKeys.description"]()}
  triggerHidden={true}
  isDismissable={false}
>
  <div class="flex flex-col gap-2">
    <Passkey.State state="click" onclick={onSetPasskey} class="justify-center" />
    <Button onclick={() => closeDialog("missing-staff-crypto")} variant="link" class="w-full">
      {m["dashboard.missingCryptoKeys.cancel"]()}
    </Button>
  </div>
</ResponsiveDialog>
