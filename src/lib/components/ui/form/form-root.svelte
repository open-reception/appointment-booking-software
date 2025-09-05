<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { Action } from "svelte/action";
  import type { HTMLAttributes } from "svelte/elements";

  export type EventReporter = (params: { isSubmitting?: boolean }) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type EnhanceFunction = Action<HTMLFormElement, any>;

  let {
    formId,
    enhance,
    class: className,
    action,
    children,
  }: {
    formId?: string;
    enhance: EnhanceFunction;
    class?: string;
    action?: string;
  } & HTMLAttributes<HTMLFormElement> = $props();
</script>

<form id={formId} method="POST" {action} use:enhance class={cn("flex flex-col gap-3", className)}>
  {@render children?.()}
</form>
