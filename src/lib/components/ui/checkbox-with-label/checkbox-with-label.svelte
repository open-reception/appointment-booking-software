<script lang="ts">
  import { Checkbox } from "../checkbox";
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";
  import { Text } from "../typography";
  import type { OnChangeFn } from "vaul-svelte";

  let {
    class: className,
    value = $bindable(false),
    label,
    onCheckedChange,
    ...restProps
  }: HTMLAttributes<HTMLButtonElement> & {
    value: boolean;
    label: string;
    id?: string;
    onCheckedChange?: OnChangeFn<boolean>;
  } = $props();
</script>

<label class={cn("flex items-center gap-2", className)}>
  <Checkbox {...restProps} checked={value} value={value ? "true" : "false"} {onCheckedChange} />
  <Text style="sm" class="font-normal">{label}</Text>
</label>
