<script lang="ts">
  import { Text } from "$lib/components/ui/typography";
  import type { HTMLAttributes } from "svelte/elements";

  let { children }: HTMLAttributes<HTMLDivElement> = $props();
</script>

<Text style="xs" class="text-medium px-5 text-center">
  {@render children?.()}
</Text>
