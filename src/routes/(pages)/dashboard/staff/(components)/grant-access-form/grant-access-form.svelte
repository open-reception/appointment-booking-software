<script lang="ts">
  import { m } from "$i18n/messages.js";
  import { CenterLoadingState, CenterState } from "$lib/components/templates/empty-state";
  import { Button } from "$lib/components/ui/button";
  import { InlineCode } from "$lib/components/ui/inline-code";
  import { TranslationWithComponent } from "$lib/components/ui/translation-with-component";
  import { Text } from "$lib/components/ui/typography";
  import { auth } from "$lib/stores/auth";
  import type { TStaff } from "$lib/types/users";
  import StopIcon from "@lucide/svelte/icons/octagon-x";
  import { toast } from "svelte-sonner";

  let { entity, done }: { entity: TStaff; done: () => void } = $props();
  const myUserRole = $derived($auth.user?.role);
  let isSubmitting = $state(false);

  const grantAccess = () => {
    isSubmitting = true;

    // Simulate an async operation
    setTimeout(() => {
      isSubmitting = false;
      toast.success(m["staff.access.success"]());
      done();
    }, 2000);

    // toast.error(m["staff.access.error"]());
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
  {:else}
    <div class="mt-6 flex flex-col gap-4">
      {#if isSubmitting}
        <CenterLoadingState label={m["staff.access.loading"]({ success: 0, total: 1 })} />
      {/if}
      <Button
        size="lg"
        type="button"
        onclick={grantAccess}
        isLoading={isSubmitting}
        disabled={isSubmitting}
      >
        {m["staff.access.action"]()}
      </Button>
    </div>
  {/if}
</div>

{#snippet inlineCode(value: string | number)}
  <InlineCode>{value}</InlineCode>
{/snippet}
