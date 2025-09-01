<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { type Props } from "$lib/components/ui/button";

  let { ref = $bindable(null), ...restProps }: Props = $props();
</script>

<Button bind:ref type="submit" {...restProps} />
