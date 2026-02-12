<script lang="ts">
  import { m } from "$i18n/messages";
  import { cn } from "$lib/utils.js";
  import AtSign from "@lucide/svelte/icons/at-sign";
  import Error from "@lucide/svelte/icons/ban";
  import Check from "@lucide/svelte/icons/check-circle";
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import Pointer from "@lucide/svelte/icons/pointer";
  import { Button } from "../button";

  export type PasskeyState = "initial" | "click" | "loading" | "user" | "success" | "error";
  let {
    state,
    class: className,
    onclick,
  }: {
    state: PasskeyState;
    class?: string;
    onclick?: () => void;
  } = $props();

  const disabledStates: PasskeyState[] = ["initial", "loading", "user", "success"];
  const onClick = () => {
    if (!disabledStates.includes(state)) {
      onclick?.();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      if (!disabledStates.includes(state)) {
        onclick?.();
      }
    }
  };
</script>

<Button
  variant="outline"
  onclick={onClick}
  class={cn(
    "flex h-10 w-full justify-start",
    state === "error" ? "dark:border-destructive border-destructive text-destructive" : "",
    className,
  )}
  onkeydown={onKeyDown}
  disabled={disabledStates.includes(state)}
>
  {#if state === "initial"}
    <AtSign class="size-4" />
    {m["passkey.add.initial"]()}
  {:else if state === "click"}
    <Pointer class="size-4" />
    {m["passkey.add.click"]()}
  {:else if state === "loading"}
    <Loader2Icon class="size-4 animate-spin" />
    {m["passkey.add.loading"]()}
  {:else if state === "user"}
    <Loader2Icon class="size-4 animate-spin" />
    {m["passkey.add.user"]()}
  {:else if state === "success"}
    <Check class="size-4" />
    {m["passkey.add.success"]()}
  {:else if state === "error"}
    <Error class="size-4" />
    <div class="flex w-full flex-wrap justify-between overflow-hidden">
      <div>{m["passkey.add.error"]()}</div>
      <div>{m["passkey.add.retry"]()}</div>
    </div>
  {/if}
</Button>
