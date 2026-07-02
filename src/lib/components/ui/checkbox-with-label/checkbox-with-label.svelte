<script lang="ts">
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import type { OnChangeFn } from "vaul-svelte";
  import { Checkbox } from "../checkbox";
  import { Text } from "../typography";
  import { Info } from "@lucide/svelte/icons";
  import { buttonVariants } from "../button";

  let {
    class: className,
    value = $bindable(false),
    label,
    color,
    tooltip,
    onCheckedChange,
    ...restProps
  }: HTMLAttributes<HTMLButtonElement> & {
    value: boolean;
    label: string;
    /** Optional color (e.g. a channel color); shown as a dot before the label. */
    color?: string | null;
    tooltip?: string;
    id?: string;
    onCheckedChange?: OnChangeFn<boolean>;
  } = $props();
</script>

<label class={cn("flex items-center gap-2", className)}>
  <div class="flex min-w-0 items-start gap-2">
    <Checkbox
      {...restProps}
      checked={value}
      value={value ? "true" : "false"}
      {onCheckedChange}
      class="mt-0.5"
    />
    <Text style="sm" class="font-normal break-words select-none">
      {#if color}<span
          class="mr-1.5 inline-block size-2 shrink-0 rounded-full align-middle"
          style="background-color: {color}"
        ></span>{/if}{label}
    </Text>
  </div>
  {#if tooltip}
    <Popover.Root>
      <Popover.Trigger class={cn(buttonVariants({ variant: "ghost", size: "xs" }), "p-1!")}>
        <Info size="sm" />
      </Popover.Trigger>
      <Popover.Content class="w-65 leading-1">
        <Text style="xs">
          {tooltip}
        </Text>
      </Popover.Content>
    </Popover.Root>
  {/if}
</label>
