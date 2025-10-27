<script lang="ts">
  import { Text } from "$lib/components/ui/typography";
  import { cn } from "$lib/utils";
  import Loader from "@lucide/svelte/icons/loader-2";

  let { class: className = "", title }: { class?: string; title: string } = $props();
</script>

<div class={cn("flex grow flex-col items-center justify-center gap-3", className)}>
  <Loader class="size-10 animate-spin" strokeWidth={1} />
  <Text style="sm" class="select-none">{title}</Text>
</div>
