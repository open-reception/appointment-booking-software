<script lang="ts">
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Text } from "$lib/components/ui/typography";
  import { cn } from "$lib/utils";
  import Loader from "@lucide/svelte/icons/loader-2";

  let { class: className = "", title }: { class?: string; title: string } = $props();
</script>

<div class={cn("flex grow flex-col gap-5", className)}>
  <div class="flex items-center gap-5">
    <Skeleton class="h-9 w-30" />
    <div class="flex items-center gap-2">
      <Loader class="size-4 animate-spin" strokeWidth={1} />
      <Text style="sm" class="select-none">{title}</Text>
    </div>
  </div>
  <div class="flex flex-col gap-2">
    <Skeleton class="h-16.5 w-full opacity-65" />
    <Skeleton class="h-16.5 w-full opacity-50" />
    <Skeleton class="h-16.5 w-full opacity-35" />
    <Skeleton class="h-16.5 w-full opacity-20" />
    <Skeleton class="h-16.5 w-full opacity-5" />
  </div>
</div>
