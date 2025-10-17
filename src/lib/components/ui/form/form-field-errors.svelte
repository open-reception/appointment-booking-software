<script lang="ts">
  /*
    Custom Changes
    * added empty:hidden
  */
  import * as FormPrimitive from "formsnap";
  import { cn, type WithoutChild } from "$lib/utils.js";
  import { Text } from "../typography";

  let {
    ref = $bindable(null),
    class: className,
    errorClasses,
    children: childrenProp,
    ...restProps
  }: WithoutChild<FormPrimitive.FieldErrorsProps> & {
    errorClasses?: string | undefined | null;
  } = $props();
</script>

<FormPrimitive.FieldErrors
  bind:ref
  class={cn("text-destructive -mt-1 ml-1 text-sm font-medium empty:hidden", className)}
  {...restProps}
>
  {#snippet children({ errors, errorProps })}
    {#if childrenProp}
      {@render childrenProp({ errors, errorProps })}
    {:else}
      <Text style="xs">
        {#each errors as error (error)}
          <div {...errorProps} class={cn(errorClasses)}>{error}</div>
        {/each}
      </Text>
    {/if}
  {/snippet}
</FormPrimitive.FieldErrors>
