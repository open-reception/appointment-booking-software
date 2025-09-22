<script lang="ts">
  import * as FormPrimitive from "formsnap";
  import { cn, type WithoutChild } from "$lib/utils.js";
  import { Text } from "../typography";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithoutChild<FormPrimitive.DescriptionProps> = $props();
</script>

<FormPrimitive.Description
  bind:ref
  data-slot="form-description"
  class={cn("text-muted-foreground -mt-1 ml-1 text-sm", className)}
  {...restProps}
>
  <Text style="xs" color="medium" class="text-medium">
    {@render children?.()}
  </Text>
</FormPrimitive.Description>
