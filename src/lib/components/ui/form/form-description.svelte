<script lang="ts">
  /*
    Custom Changes
    * use Text component for consistent typography
    * custom margin and padding
    * added leading-none
  */
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
  class={cn("text-muted-foreground -mt-1 ml-px leading-none", className)}
  {...restProps}
>
  <Text style="xs" color="medium" class="leading-none">
    {@render children?.()}
  </Text>
</FormPrimitive.Description>
