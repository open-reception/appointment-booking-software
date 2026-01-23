<script lang="ts">
  import * as InputOTP from "$lib/components/ui/input-otp/index.js";
  import { PinInput as InputOTPPrimitive } from "bits-ui";

  type Props = Omit<InputOTPPrimitive.RootProps, "maxlength">;

  let { value = $bindable(), ...restProps }: Props = $props();
</script>

<InputOTP.Root
  {...restProps}
  maxlength={6}
  type="password"
  pushPasswordManagerStrategy="none"
  bind:value
>
  {#snippet children({ cells })}
    <InputOTP.Group>
      {#each cells.slice(0, 3) as cell (cell)}
        <InputOTP.Slot aria-invalid={restProps["aria-invalid"]} {cell} />
      {/each}
    </InputOTP.Group>
    <InputOTP.Separator />
    <InputOTP.Group>
      {#each cells.slice(3, 6) as cell (cell)}
        <InputOTP.Slot aria-invalid={restProps["aria-invalid"]} {cell} />
      {/each}
    </InputOTP.Group>
  {/snippet}
</InputOTP.Root>
