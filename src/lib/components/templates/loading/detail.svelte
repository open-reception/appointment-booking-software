<script lang="ts">
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Text } from "$lib/components/ui/typography";
  import { cn } from "$lib/utils";
  import Loader from "@lucide/svelte/icons/loader-2";

  let { class: className = "", title }: { class?: string; title: string } = $props();
</script>

<div class={cn("flex grow flex-col gap-7", className)}>
  <div class="flex flex-col items-start gap-1">
    <Skeleton class="h-6 w-20" />
    <Skeleton class="h-8 w-50" />
    <div class="flex items-center gap-2">
      <Loader class="size-3 animate-spin" strokeWidth={1} />
      <Text style="sm" class="select-none">{title}</Text>
    </div>
  </div>
  <div class="flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-20">
    <div class="flex flex-col gap-2">
      <Skeleton class="h-6 w-20 opacity-65" />
      <Skeleton class="h-4 w-full opacity-50" />
      <Skeleton class="h-4 w-1/2 opacity-50" />
    </div>
    <div class="flex flex-col gap-2 md:col-span-2">
      <Skeleton class="h-30 w-full opacity-35" />
      <Skeleton class="h-30 w-full opacity-25" />
    </div>
  </div>
</div>
